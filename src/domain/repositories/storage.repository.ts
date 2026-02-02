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

	putObject(
		bucket: string,
		key: string,
		body: ArrayBuffer | Uint8Array,
		contentType: string,
	): Promise<void>;

	/**
	 * Get object metadata (size, etag, etc.) without downloading the object.
	 * Returns null if object doesn't exist.
	 */
	headObject(
		bucket: string,
		key: string,
	): Promise<{ sizeBytes: number; etag: string } | null>;
}
