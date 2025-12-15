/**
 * Library domain entity types.
 * Represents unified view of user files and scribe projects.
 */

export type LibraryItemSource = "user_file" | "scribe_project";

export type LibraryItemType =
	| "scribe_doc"
	| "audio"
	| "pdf"
	| "image"
	| "summary"
	| "other";

export type LibraryItemStatus =
	| "needs_input"
	| "processing"
	| "blocked"
	| "available"
	| "failed"
	| "final";

/**
 * Unified library item representing either a user file or scribe project.
 */
export interface LibraryItem {
	id: string;
	source: LibraryItemSource;
	title: string;
	type: LibraryItemType;
	subjectId: string | null;
	subjectName: string | null;
	subjectColor: string | null;
	date: string;
	sizeBytes: number | null;
	status: LibraryItemStatus;
	linkedTaskId: string | null;
	linkedTaskTitle: string | null;
	r2Key: string | null;
	mimeType: string | null;
}

/**
 * Storage usage information for a user profile.
 */
export interface StorageUsage {
	usedBytes: number;
	totalBytes: number;
	tier: "free" | "pro" | "premium";
}

/**
 * Pending file record for presigned upload flow.
 */
export interface PendingFileRecord {
	id: string;
	userId: string;
	r2Key: string;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
	subjectId: string | null;
	taskId: string | null;
}

/**
 * Storage tier limits in bytes.
 */
export const STORAGE_TIER_LIMITS: Record<"free" | "pro" | "premium", number> = {
	free: 1_073_741_824, // 1 GB
	pro: 10_737_418_240, // 10 GB
	premium: 107_374_182_400, // 100 GB
};
