import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateProfileUseCase } from "../../../application/profiles/create-profile.usecase";
import { extractProfileDataFromWebhook } from "../../../application/profiles/profile.mapper";
import { UpsertProfileIdentityUseCase } from "../../../application/profiles/upsert-profile-identity.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { verifySvixSignature } from "../../../infrastructure/auth/svix-webhook";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";
import {
	ClerkNewUserWebhookPayloadSchema,
	ClerkUpdateUserWebhookPayloadSchema,
} from "../validators/profile.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };

type WebhookSuccessResponse = {
	success: true;
	profileId: string;
	action?: "created" | "updated" | "noop";
};

const WebhookSuccessResponseSchema = z.object({
	success: z.literal(true),
	profileId: z.string(),
	action: z.enum(["created", "updated", "noop"]).optional(),
});

const ErrorResponseSchema = z.object({ error: z.string() });

export class CreateProfileEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Webhooks"],
		summary: "Create profile from Clerk user.created",
		description:
			"Webhook endpoint for Clerk user.created. Verifies Svix signature and creates a profile.",
		request: {
			body: contentJson(ClerkNewUserWebhookPayloadSchema),
		},
		responses: {
			"201": {
				description: "Profile created",
				...contentJson(WebhookSuccessResponseSchema),
			},
			"400": {
				description: "Invalid payload",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Invalid webhook signature",
				...contentJson(ErrorResponseSchema),
			},
			"409": {
				description: "Profile already exists",
				...contentJson(
					z.object({ success: z.literal(false), error: z.string() }),
				),
			},
			"500": {
				description: "Internal error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: Context<HonoContext>) {
		try {
			const webhookSecret = await resolveSecretBinding(
				c.env.CLERK_NEW_USER_WEBHOOK_SECRET,
				"CLERK_NEW_USER_WEBHOOK_SECRET",
			);

			const rawBody = await c.req.text();

			const headers: Record<string, string | undefined> = {
				"svix-id": c.req.header("svix-id"),
				"svix-timestamp": c.req.header("svix-timestamp"),
				"svix-signature": c.req.header("svix-signature"),
			};

			const isValid = await verifySvixSignature(
				rawBody,
				headers,
				webhookSecret,
			);
			if (!isValid) return c.json({ error: "Unauthorized" }, 401);

			const payload = JSON.parse(rawBody);
			const validationResult =
				ClerkNewUserWebhookPayloadSchema.safeParse(payload);
			if (!validationResult.success)
				return c.json({ error: "Invalid payload" }, 400);

			const profileData = extractProfileDataFromWebhook(validationResult.data);

			const db = DatabaseFactory.create(c.env.DB);
			const profileRepository = new D1ProfileRepository(db);
			const useCase = new CreateProfileUseCase(profileRepository);

			const profile = await useCase.execute({
				id: profileData.id,
				email: profileData.email,
				name: profileData.name,
			});

			const response: WebhookSuccessResponse = {
				success: true,
				profileId: profile.id,
			};

			return c.json(response, 201);
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === "Profile already exists"
			) {
				return c.json({ success: false, error: "Profile already exists" }, 409);
			}
			console.error("Error processing Clerk user.created webhook:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

export class UpdateProfileFromClerkEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Webhooks"],
		summary: "Update profile from Clerk user.updated",
		description:
			"Webhook endpoint for Clerk user.updated. Verifies Svix signature and updates profile identity fields.",
		request: {
			body: contentJson(ClerkUpdateUserWebhookPayloadSchema),
		},
		responses: {
			"200": {
				description: "Profile updated (or no-op)",
				...contentJson(WebhookSuccessResponseSchema),
			},
			"400": {
				description: "Invalid payload",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Invalid webhook signature",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: Context<HonoContext>) {
		try {
			const webhookSecret = await resolveSecretBinding(
				c.env.CLERK_UPDATE_USER_WEBHOOK_SECRET,
				"CLERK_UPDATE_USER_WEBHOOK_SECRET",
			);

			const rawBody = await c.req.text();

			const headers: Record<string, string | undefined> = {
				"svix-id": c.req.header("svix-id"),
				"svix-timestamp": c.req.header("svix-timestamp"),
				"svix-signature": c.req.header("svix-signature"),
			};

			const isValid = await verifySvixSignature(
				rawBody,
				headers,
				webhookSecret,
			);
			if (!isValid) return c.json({ error: "Unauthorized" }, 401);

			const payload = JSON.parse(rawBody);
			const validationResult =
				ClerkUpdateUserWebhookPayloadSchema.safeParse(payload);
			if (!validationResult.success)
				return c.json({ error: "Invalid payload" }, 400);

			const profileData = extractProfileDataFromWebhook(validationResult.data);

			const db = DatabaseFactory.create(c.env.DB);
			const profileRepository = new D1ProfileRepository(db);
			const useCase = new UpsertProfileIdentityUseCase(profileRepository);

			const result = await useCase.execute({
				id: profileData.id,
				email: profileData.email,
				name: profileData.name,
			});

			const response: WebhookSuccessResponse = {
				success: true,
				profileId: result.profileId,
				action: result.action,
			};

			return c.json(response, 200);
		} catch (error) {
			console.error("Error processing Clerk user.updated webhook:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
