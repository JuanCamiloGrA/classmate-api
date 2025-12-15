import { and, eq } from "drizzle-orm";
import type { Profile, ProfileData } from "../../../domain/entities/profile";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository";
import type { Database } from "../client";
import { profiles } from "../schema";

export class D1ProfileRepository implements ProfileRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<Profile | null> {
		const result = await this.db
			.select()
			.from(profiles)
			.where(eq(profiles.id, id))
			.get();

		return result || null;
	}

	async create(profile: ProfileData): Promise<Profile> {
		try {
			const newProfile = await this.db
				.insert(profiles)
				.values({
					id: profile.id,
					email: profile.email,
					name: profile.name,
					subscriptionTier: "free",
					storageUsedBytes: 0,
				})
				.returning()
				.get();

			return newProfile;
		} catch (error) {
			// D1/SQLite constraint violations contain "UNIQUE constraint" or "SQLITE_CONSTRAINT"
			if (
				error instanceof Error &&
				(error.message.includes("UNIQUE constraint") ||
					error.message.includes("SQLITE_CONSTRAINT"))
			) {
				throw new Error("Profile with this email already exists");
			}
			throw error;
		}
	}

	async existsById(id: string): Promise<boolean> {
		const result = await this.db
			.select({ id: profiles.id })
			.from(profiles)
			.where(eq(profiles.id, id))
			.get();

		return result !== undefined && result !== null;
	}

	async updateScribeStyleSlot(
		userId: string,
		slot: 1 | 2,
		data: { r2Key: string; mimeType: string; originalFilename: string },
	): Promise<Profile> {
		const now = new Date().toISOString();

		const updatePayload =
			slot === 1
				? {
						scribeStyleSlot1R2Key: data.r2Key,
						scribeStyleSlot1MimeType: data.mimeType,
						scribeStyleSlot1OriginalFilename: data.originalFilename,
						updatedAt: now,
					}
				: {
						scribeStyleSlot2R2Key: data.r2Key,
						scribeStyleSlot2MimeType: data.mimeType,
						scribeStyleSlot2OriginalFilename: data.originalFilename,
						updatedAt: now,
					};

		const updated = await this.db
			.update(profiles)
			.set(updatePayload)
			.where(and(eq(profiles.id, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new Error("Profile not found");
		}

		return updated;
	}
}
