import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateProfileUseCase } from "../../../application/profiles/create-profile.usecase";
import { GetProfileUseCase } from "../../../application/profiles/get-profile.usecase";
import { extractProfileDataFromClerkUser } from "../../../application/profiles/profile.mapper";
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
			"Retrieve the authenticated user's profile. If the profile doesn't exist (e.g., webhook was not active during signup), it will be automatically created by fetching user data from Clerk. Requires valid Clerk JWT token in Authorization header.",
		responses: {
			"200": {
				description: "Profile found and returned (or auto-created if missing)",
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
			const getUseCase = new GetProfileUseCase(profileRepository);

			// Try to get existing profile
			let profile = await getUseCase.execute(auth.userId).catch((error) => {
				if (error instanceof Error && error.message === "Profile not found") {
					return null;
				}
				throw error;
			});

			// If profile doesn't exist, fetch from Clerk and create it
			if (!profile) {
				console.log(
					`Profile not found for user ${auth.userId}, fetching from Clerk...`,
				);

				// Get Clerk client from context
				const clerkClient = c.get("clerk");
				if (!clerkClient) {
					console.error("Clerk client not available in context");
					return c.json({ error: "Internal server error" }, 500);
				}

				// Fetch user data from Clerk
				const clerkUser = await clerkClient.users.getUser(auth.userId);

				// Extract profile data from Clerk user
				const profileData = extractProfileDataFromClerkUser(clerkUser);

				// Create the profile
				const createUseCase = new CreateProfileUseCase(profileRepository);
				profile = await createUseCase.execute(profileData);

				console.log(`Auto-created profile for user ${auth.userId}`);
			}

			return c.json({
				success: true,
				profile,
			});
		} catch (error) {
			console.error("Error getting/creating profile:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
