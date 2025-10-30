import type { Bindings } from "../../config/bindings";
import { resolveSecretBinding } from "../../config/bindings";
import type {
	FileInput,
	ProcessingService,
} from "../../domain/services/processing.service";

/**
 * Cloud Run Processing Service Adapter
 * Implements ProcessingService using the Heavy API (Cloud Run)
 */
export class CloudRunProcessingService implements ProcessingService {
	constructor(private env: Bindings) {}

	/**
	 * Process a file from an external URL using the Heavy API
	 * The Heavy API handles downloading, audio extraction, and R2 upload
	 *
	 * @param sourceUrl - The URL of the file to process
	 * @param userId - The ID of the user who owns the class
	 * @param classId - The ID of the class being processed
	 * @returns FileInput metadata for the processed file in R2
	 * @throws Error if the Heavy API returns a non-2xx response
	 */
	async processUrl(
		sourceUrl: string,
		userId: string,
		classId: string,
	): Promise<FileInput> {
		const processingServiceUrl = await resolveSecretBinding(
			this.env.PROCESSING_SERVICE_URL,
			"PROCESSING_SERVICE_URL",
		);
		const internalApiKey = await resolveSecretBinding(
			this.env.INTERNAL_API_KEY,
			"INTERNAL_API_KEY",
		);

		// Construct the full URL with the specific route for processing URLs
		const processUrl = new URL(
			"/api/v1/process-url",
			processingServiceUrl,
		).toString();

		const response = await fetch(processUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Internal-API-Key": internalApiKey,
			},
			body: JSON.stringify({
				sourceUrl,
				userId,
				classId,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(
				`Processing service failed with status ${response.status}: ${errorText}`,
			);
		}

		const result = await response.json<FileInput>();
		return result;
	}
}
