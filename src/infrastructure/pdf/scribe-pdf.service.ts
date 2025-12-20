import type { DevLogger } from "../logging/dev-logger";

/**
 * Scribe PDF Generation Service
 * Calls the external SCRIBE_HEAVY_API_URL to compile Typst to PDF
 *
 * Request fields match TypesetterOutput schema from the AI typesetter agent
 */

/**
 * Author information for document metadata
 */
export interface ScribePdfAuthor {
	name: string;
	affiliation: string;
	email?: string;
}

/**
 * Document metadata for PDF generation
 */
export interface ScribePdfMetadata {
	title: string;
	authors: ScribePdfAuthor[];
	date: string;
	abstract?: string;
}

/**
 * Document content for PDF generation
 */
export interface ScribePdfContent {
	/** Raw Typst content (headings, text, math, code blocks). NO imports. */
	body: string;
	/** BibTeX string containing all citations */
	references: string;
}

/**
 * Request payload for the Heavy API
 */
export interface ScribePdfRequest {
	/** User ID for path organization (required) */
	user_id: string;
	/** Template ID for Typst generation (e.g., "apa", "ieee") */
	template_id: string;
	/** Document metadata */
	metadata: ScribePdfMetadata;
	/** Document content */
	content: ScribePdfContent;
	/** Dynamic template configuration fields */
	template_config: Record<string, unknown>;
}

export interface ScribePdfSuccessResponse {
	/** R2 object key where PDF is stored */
	r2Key: string;
	/** Generated filename */
	filename: string;
	/** Always "application/pdf" */
	mimeType: string;
}

export interface ScribePdfErrorResponse {
	success: false;
	error_code: string;
	error_message: string;
	details?: string;
}

export type ScribePdfResponse =
	| ScribePdfSuccessResponse
	| ScribePdfErrorResponse;

export class ScribePdfGenerationError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly errorCode?: string,
		readonly errorMessage?: string,
		readonly details?: string,
	) {
		super(message);
		this.name = "ScribePdfGenerationError";
	}
}

/**
 * Service for generating PDFs from Typst content via the heavy processing API
 */
export class ScribePdfService {
	constructor(
		private readonly apiUrl: string,
		private readonly apiKey: string,
		private readonly logger?: DevLogger,
	) {
		console.log("📄 [SCRIBE_PDF] Initialized Typst PDF generation service");
	}

	/**
	 * Generates a PDF from Typst content
	 * @param request - The PDF generation request with Typst payload
	 * @returns The R2 key and filename of the generated PDF
	 * @throws Error if PDF generation fails
	 */
	async generatePdf(
		request: ScribePdfRequest,
	): Promise<ScribePdfSuccessResponse> {
		console.log("🔄 [SCRIBE_PDF] Generating PDF", {
			userId: request.user_id,
			templateId: request.template_id,
			title: request.metadata.title,
			bodyLength: request.content.body.length,
		});

		this.logger?.logRequest(
			"SCRIBE_PDF",
			`${this.apiUrl}/v1/generate`,
			"POST",
			request,
			{ "X-API-KEY": "***" },
		);

		const response = await fetch(`${this.apiUrl}/v1/generate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": this.apiKey,
			},
			body: JSON.stringify(request),
		});

		const data = (await response.json()) as ScribePdfResponse;

		this.logger?.logResponse(
			"SCRIBE_PDF",
			`${this.apiUrl}/v1/generate`,
			response.status,
			data,
		);

		if (!response.ok) {
			const errorData = data as ScribePdfErrorResponse;
			console.error("❌ [SCRIBE_PDF] PDF generation failed", {
				status: response.status,
				errorCode: errorData.error_code,
				errorMessage: errorData.error_message,
				details: errorData.details,
			});
			throw new ScribePdfGenerationError(
				`PDF generation failed: ${errorData.error_message || "Unknown error"}`,
				response.status,
				errorData.error_code,
				errorData.error_message,
				errorData.details,
			);
		}

		const successData = data as ScribePdfSuccessResponse;
		console.log("✅ [SCRIBE_PDF] PDF generated successfully", {
			r2Key: successData.r2Key,
			filename: successData.filename,
		});

		return successData;
	}
}
