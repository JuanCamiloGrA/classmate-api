/**
 * Represents a user profile in the system.
 * @interface Profile
 */
export interface Profile {
	/** Unique identifier (Clerk user ID) */
	id: string;
	/** User's email address */
	email: string | null;
	/** User's display name */
	name: string | null;
	/** Current subscription tier */
	subscriptionTier: "free" | "pro" | "premium";
	/** Storage used in bytes */
	storageUsedBytes: number;
	/** ISO 8601 timestamp of profile creation */
	createdAt: string;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

/**
 * Input data for creating a new profile.
 * Subset of Profile interface used during creation flow.
 * @interface ProfileData
 */
export interface ProfileData {
	/** Unique identifier (Clerk user ID) */
	id: string;
	/** User's email address */
	email: string | null;
	/** User's display name */
	name: string | null;
}
