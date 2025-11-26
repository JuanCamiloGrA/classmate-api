import type {
	LibraryItem,
	LibraryItemType,
	PendingFileRecord,
	StorageUsage,
} from "../entities/library";

/**
 * Filters for listing library items.
 */
export interface LibraryFilters {
	search?: string;
	type?: LibraryItemType | "all";
	subjectId?: string;
	sortBy?: "date" | "name";
	sortOrder?: "asc" | "desc";
	limit?: number;
	offset?: number;
}

/**
 * Result of listing library items with pagination metadata.
 */
export interface LibraryListResult {
	data: LibraryItem[];
	total: number;
}

/**
 * Repository interface for library operations.
 * Aggregates data from user_files and scribe_projects tables.
 */
export interface LibraryRepository {
	/**
	 * Find all library items for a user with optional filters.
	 */
	findAll(userId: string, filters: LibraryFilters): Promise<LibraryListResult>;

	/**
	 * Get storage usage for a user.
	 */
	getStorageUsage(userId: string): Promise<StorageUsage | null>;

	/**
	 * Create a pending file record for presigned upload.
	 */
	createPendingFile(file: PendingFileRecord): Promise<void>;

	/**
	 * Confirm file upload and update storage usage.
	 */
	confirmUpload(fileId: string, userId: string): Promise<boolean>;

	/**
	 * Get file record by ID and user.
	 */
	getFileById(
		fileId: string,
		userId: string,
	): Promise<{
		id: string;
		r2Key: string;
		sizeBytes: number;
	} | null>;

	/**
	 * Delete a user file (hard delete).
	 */
	deleteUserFile(fileId: string, userId: string): Promise<boolean>;

	/**
	 * Soft delete a scribe project.
	 */
	softDeleteScribeProject(projectId: string, userId: string): Promise<boolean>;

	/**
	 * Update storage used bytes for a user profile.
	 */
	updateStorageUsage(userId: string, deltaBytes: number): Promise<void>;

	/**
	 * Link file to a task (optional).
	 */
	linkFileToTask(fileId: string, taskId: string): Promise<void>;
}
