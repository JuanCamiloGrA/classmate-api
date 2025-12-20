import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { GetProfileUseCase } from "../../../application/profiles/get-profile.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";

type HonoContext = { Bindings: Bindings; Variables: Variables };

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
