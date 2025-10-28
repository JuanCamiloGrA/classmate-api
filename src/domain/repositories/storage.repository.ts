export interface StorageRepository {
	generatePresignedPutUrl(
		bucket: string,
		key: string,
		contentType: string,
		expiresInSeconds: number,
	): Promise<string>;
}
