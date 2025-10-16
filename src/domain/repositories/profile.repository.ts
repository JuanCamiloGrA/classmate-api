import type { Profile, ProfileData } from "../entities/profile";

/**
 * Repository interface for profile persistence operations.
 * Defines the contract for profile data access.
 * Implementations must handle D1 database operations.
 * @interface ProfileRepository
 */
export interface ProfileRepository {
	/**
	 * Retrieve a profile by user ID.
	 * @param id - The user ID to search for
	 * @returns The profile if found, null otherwise
	 */
	findById(id: string): Promise<Profile | null>;

	/**
	 * Create a new profile in the database.
	 * @param profile - Profile data to persist
	 * @returns The created profile with system fields (timestamps)
	 */
	create(profile: ProfileData): Promise<Profile>;

	/**
	 * Check if a profile exists for a given user ID.
	 * @param id - The user ID to check
	 * @returns True if profile exists, false otherwise
	 */
	existsById(id: string): Promise<boolean>;
}
