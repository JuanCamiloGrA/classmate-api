export interface StorageRepository {
	generatePresignedPutUrl(
		bucket: string,
		key: string,
		contentType: string,
		expiresInSeconds: number,
	): Promise<string>;

	generatePresignedGetUrl(
		bucket: string,
		key: string,
		expiresInSeconds: number,
	): Promise<string>;

	/**
	 * Get object metadata (size, etag, etc.) without downloading the object.
	 * Returns null if object doesn't exist.
	 */
	headObject(
		bucket: string,
		key: string,
	): Promise<{ sizeBytes: number; etag: string } | null>;
}
