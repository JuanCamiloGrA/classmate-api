/**
 * Processing Service Interface
 * Port for external processing operations
 */

export interface FileInput {
	r2Key: string;
	filename: string;
	mimeType: string;
}

/**
 * Service for delegating heavy file processing operations
 */
export interface ProcessingService {
	/**
	 * Process a file from an external URL
	 * Downloads the file, extracts audio if needed, and uploads to R2
	 *
	 * @param sourceUrl - The URL of the file to process
	 * @param userId - The ID of the user who owns the class
	 * @param classId - The ID of the class being processed
	 * @returns FileInput metadata for the processed file in R2
	 * @throws Error if the processing service fails
	 */
	processUrl(
		sourceUrl: string,
		userId: string,
		classId: string,
	): Promise<FileInput>;
}
