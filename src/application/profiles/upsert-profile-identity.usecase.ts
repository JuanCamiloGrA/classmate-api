import type { ProfileData } from "../../domain/entities/profile";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";

export type UpsertProfileIdentityResult = {
	action: "created" | "updated" | "noop";
	profileId: string;
};

/**
 * Upserts profile identity fields (name/email) from an external source-of-truth.
 * Intended for server-to-server webhooks (e.g., Clerk user.updated).
 */
export class UpsertProfileIdentityUseCase {
	constructor(private profileRepository: ProfileRepository) {}

	async execute(profile: ProfileData): Promise<UpsertProfileIdentityResult> {
		return this.profileRepository.upsertIdentityFromWebhook(profile);
	}
}
