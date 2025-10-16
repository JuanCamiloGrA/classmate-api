import { eq } from "drizzle-orm";
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
	}

	async existsById(id: string): Promise<boolean> {
		const result = await this.db
			.select({ id: profiles.id })
			.from(profiles)
			.where(eq(profiles.id, id))
			.get();

		return result !== null;
	}
}
