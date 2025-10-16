import type { ProfileRepository } from "../../domain/repositories/profile.repository";

/**
 * Use case for retrieving a user profile.
 * Handles business logic for profile retrieval:
 * - Queries profile by user ID
 * - Returns profile or raises not found error
 *
 * @class GetProfileUseCase
 * @example
 * ```typescript
 * const useCase = new GetProfileUseCase(profileRepository);
 * const profile = await useCase.execute('user_xxxxx');
 * ```
 */
export class GetProfileUseCase {
	/**
	 * @param profileRepository - Repository for profile persistence
	 */
	constructor(private profileRepository: ProfileRepository) {}

	/**
	 * Execute profile retrieval.
	 * @param userId - Clerk user ID to retrieve profile for
	 * @returns User's profile
	 * @throws Error with message "Profile not found" if user has no profile
	 */
	async execute(userId: string) {
		const profile = await this.profileRepository.findById(userId);

		if (!profile) {
			throw new Error("Profile not found");
		}

		return profile;
	}
}
