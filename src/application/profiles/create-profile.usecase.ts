import type { ProfileData } from "../../domain/entities/profile";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";

/**
 * Input data for creating a profile.
 * Typically extracted from Clerk webhook payload.
 * @interface CreateProfileInput
 */
export interface CreateProfileInput {
	/** Clerk user ID */
	id: string;
	/** User's primary email */
	email: string | null;
	/** User's display name */
	name: string | null;
}

/**
 * Use case for creating a new user profile.
 * Handles business logic for profile creation:
 * - Validates profile doesn't already exist (idempotency)
 * - Creates profile with default subscription tier (free)
 * - Returns created profile
 *
 * @class CreateProfileUseCase
 * @example
 * ```typescript
 * const useCase = new CreateProfileUseCase(profileRepository);
 * const profile = await useCase.execute({
 *   id: 'user_xxxxx',
 *   email: 'user@example.com',
 *   name: 'John Doe'
 * });
 * ```
 */
export class CreateProfileUseCase {
	/**
	 * @param profileRepository - Repository for profile persistence
	 */
	constructor(private profileRepository: ProfileRepository) {}

	/**
	 * Execute profile creation.
	 * @param input - Profile creation input
	 * @returns Created profile with system fields
	 * @throws Error with message "Profile already exists" if duplicate detected
	 * @throws Database errors from repository layer
	 */
	async execute(input: CreateProfileInput) {
		// Check if profile already exists
		const exists = await this.profileRepository.existsById(input.id);
		if (exists) {
			throw new Error("Profile already exists");
		}

		// Create the profile
		const profileData: ProfileData = {
			id: input.id,
			email: input.email,
			name: input.name,
		};

		// Repository will throw "Profile already exists" if email constraint is violated
		const profile = await this.profileRepository.create(profileData);
		return profile;
	}
}
