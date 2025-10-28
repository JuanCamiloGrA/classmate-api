/**
 * Storage Service Interface (Port)
 * Defines contract for file storage operations
 */
export interface StorageService {
	/**
	 * Retrieve file content as bytes
	 */
	getFileBytes(key: string): Promise<Uint8Array>;

	/**
	 * Delete file from storage
	 */
	deleteFile(key: string): Promise<void>;
}
