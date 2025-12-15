import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateProfileUseCase } from "../../../application/profiles/create-profile.usecase";
import { GetProfileUseCase } from "../../../application/profiles/get-profile.usecase";
import { extractProfileDataFromWebhook } from "../../../application/profiles/profile.mapper";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { verifySvixSignature } from "../../../infrastructure/auth/svix-webhook";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";
import { ClerkWebhookPayloadSchema } from "../validators/profile.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };

/**
 * POST /profiles
 * Webhook endpoint for Clerk user.created event.
 * Verifies Svix signature and creates user profile in D1.
 */
export class CreateProfileEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Profiles"],
		summary: "Create user profile from Clerk webhook",
		description:
			"Webhook endpoint for Clerk user.created event. Verifies Svix signature and creates user profile in D1.",
		request: {
			body: contentJson(ClerkWebhookPayloadSchema),
		},
		responses: {
			"201": {
				description: "Profile created successfully",
				...contentJson(
					z.object({
						success: z.literal(true),
						message: z.string(),
						profileId: z.string(),
					}),
				),
			},
			"400": {
				description: "Invalid payload structure",
				...contentJson(z.object({ error: z.string() })),
			},
			"401": {
				description: "Invalid or missing webhook signature",
				...contentJson(z.object({ error: z.string() })),
			},
			"409": {
				description: "Profile already exists",
				...contentJson(
					z.object({ success: z.literal(false), error: z.string() }),
				),
			},
			"500": {
				description: "Internal server error",
				...contentJson(z.object({ error: z.string() })),
			},
		},
	};

	async handle(c: Context<HonoContext>) {
		try {
			// Get the webhook secret from environment
			const webhookSecret = await resolveSecretBinding(
				c.env.CLERK_WEBHOOK_SECRET,
				"CLERK_WEBHOOK_SECRET",
			);

			// Get raw body for signature verification
			const rawBody = await c.req.text();

			// Verify webhook signature
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

			if (!isValid) {
				console.warn("Invalid webhook signature");
				return c.json({ error: "Unauthorized" }, 401);
			}

			// Parse and validate the payload
			const payload = JSON.parse(rawBody);
			const validationResult = ClerkWebhookPayloadSchema.safeParse(payload);

			if (!validationResult.success) {
				console.error("Invalid webhook payload:", validationResult.error);
				return c.json({ error: "Invalid payload" }, 400);
			}

			// Extract profile data
			const profileData = extractProfileDataFromWebhook(validationResult.data);

			// Create use case with repository
			const db = DatabaseFactory.create(c.env.DB);
			const profileRepository = new D1ProfileRepository(db);
			const useCase = new CreateProfileUseCase(profileRepository);

			// Execute use case
			const profile = await useCase.execute({
				id: profileData.id,
				email: profileData.email,
				name: profileData.name,
			});

			return c.json(
				{
					success: true,
					message: "Profile created successfully",
					profileId: profile.id,
				},
				201,
			);
		} catch (error) {
			// Check for duplicate profile error
			if (
				error instanceof Error &&
				error.message === "Profile already exists"
			) {
				console.warn("Profile already exists");
				return c.json(
					{
						success: false,
						error: "Profile already exists",
					},
					409,
				);
			}

			console.error("Error processing webhook:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

/**
 * GET /profiles/me
 * Retrieve the authenticated user's profile.
 * Requires valid Clerk JWT token in Authorization header.
 */
export class GetProfileEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Profiles"],
		summary: "Get authenticated user profile",
		description:
			"Retrieve the authenticated user's profile. Requires valid Clerk JWT token in Authorization header.",
		responses: {
			"200": {
				description: "Profile found and returned",
				...contentJson(
					z.object({
						success: z.literal(true),
						profile: z.object({
							id: z.string(),
							email: z.string().nullable(),
							name: z.string().nullable(),
							subscriptionTier: z.enum(["free", "pro", "premium"]),
							storageUsedBytes: z.number(),
							scribeStyleSlot1R2Key: z.string().nullable(),
							scribeStyleSlot1MimeType: z.string().nullable(),
							scribeStyleSlot1OriginalFilename: z.string().nullable(),
							scribeStyleSlot2R2Key: z.string().nullable(),
							scribeStyleSlot2MimeType: z.string().nullable(),
							scribeStyleSlot2OriginalFilename: z.string().nullable(),
							createdAt: z.string(),
							updatedAt: z.string(),
						}),
					}),
				),
			},
			"401": {
				description: "Missing or invalid JWT token",
				...contentJson(z.object({ error: z.string() })),
			},
			"404": {
				description: "User has no profile yet",
				...contentJson(z.object({ error: z.string() })),
			},
			"500": {
				description: "Internal server error",
				...contentJson(z.object({ error: z.string() })),
			},
		},
	};

	async handle(c: Context<HonoContext>) {
		try {
			// Get authenticated user from Clerk
			const auth = getAuth(c);
			if (!auth?.userId) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			// Create use case with repository
			const db = DatabaseFactory.create(c.env.DB);
			const profileRepository = new D1ProfileRepository(db);
			const useCase = new GetProfileUseCase(profileRepository);

			// Execute use case
			const profile = await useCase.execute(auth.userId);

			return c.json({
				success: true,
				profile,
			});
		} catch (error) {
			if (error instanceof Error && error.message === "Profile not found") {
				return c.json({ error: "Profile not found" }, 404);
			}

			console.error("Error getting profile:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
