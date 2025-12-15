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
	/** Scribe: Style reference slot 1 (R2 key) */
	scribeStyleSlot1R2Key: string | null;
	/** Scribe: Style reference slot 1 MIME type */
	scribeStyleSlot1MimeType: string | null;
	/** Scribe: Style reference slot 1 original filename */
	scribeStyleSlot1OriginalFilename: string | null;
	/** Scribe: Style reference slot 2 (R2 key) */
	scribeStyleSlot2R2Key: string | null;
	/** Scribe: Style reference slot 2 MIME type */
	scribeStyleSlot2MimeType: string | null;
	/** Scribe: Style reference slot 2 original filename */
	scribeStyleSlot2OriginalFilename: string | null;
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
