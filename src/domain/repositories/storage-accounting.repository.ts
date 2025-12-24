/**
 * Repository interface for managing storage accounting and quota tracking.
 */

export type BucketType = "persistent" | "temporal";
export type StorageObjectStatus = "pending" | "confirmed" | "deleted";

export interface StorageObject {
	id: string;
	userId: string;
	r2Key: string;
	bucketType: BucketType;
	status: StorageObjectStatus;
	sizeBytes: number;
	confirmedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateStorageObjectInput {
	userId: string;
	r2Key: string;
	bucketType: BucketType;
	sizeBytes: number;
}

export interface ConfirmStorageObjectInput {
	r2Key: string;
	actualSizeBytes: number;
}

export interface ConfirmStorageObjectResult {
	deltaBytes: number;
	storageObject: StorageObject;
}

export interface StorageAccountingRepository {
	/**
	 * Create or update a storage object record (upsert).
	 * If object exists, updates status to pending and returns existing record.
	 */
	createOrUpdatePending(
		input: CreateStorageObjectInput,
	): Promise<StorageObject>;

	/**
	 * Confirm an upload by marking object as confirmed and updating size.
	 * Returns the delta (actualSize - previousSize) to apply to user's storage.
	 * This operation is idempotent - confirming multiple times with same size
	 * returns 0 delta.
	 */
	confirmUpload(input: ConfirmStorageObjectInput): Promise<{
		deltaBytes: number;
		storageObject: StorageObject;
	}>;

	/**
	 * Mark a storage object as deleted (soft delete).
	 * Returns the size to subtract from user's storage.
	 */
	markDeleted(r2Key: string): Promise<{ deltaBytes: number }>;

	/**
	 * Get storage object by R2 key.
	 */
	getByR2Key(r2Key: string): Promise<StorageObject | null>;

	/**
	 * Get all confirmed storage objects for a user.
	 */
	listConfirmedByUser(userId: string): Promise<StorageObject[]>;
}
