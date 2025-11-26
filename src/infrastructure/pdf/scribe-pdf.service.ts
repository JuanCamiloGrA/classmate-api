/**
 * Scribe PDF Generation Service
 * Calls the external SCRIBE_HEAVY_API_URL to compile LaTeX to PDF
 *
 * Request fields match TypesetterOutput schema from the AI typesetter agent
 */

export interface ScribePdfRequest {
	/** User ID for path organization (required) */
	user_id: string;
	/** Document title extracted from the heading or metadata */
	title: string;
	/** Course name if mentioned, otherwise 'Academic Document' */
	course: string;
	/** Student name if mentioned, otherwise 'Student' */
	student: string;
	/** Date in format 'DD of Month, YYYY' (e.g., 'November 25, 2025') */
	date: string;
	/** LaTeX body content starting with \section{} - NO preamble or document wrapper */
	latex_content: string;
}

export interface ScribePdfSuccessResponse {
	/** R2 object key where PDF is stored (camelCase) */
	r2Key: string;
	/** Generated filename */
	filename: string;
	/** Always "application/pdf" (camelCase) */
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

/**
 * Service for generating PDFs from LaTeX via the heavy processing API
 */
export class ScribePdfService {
	constructor(
		private readonly apiUrl: string,
		private readonly apiKey: string,
	) {
		console.log("📄 [SCRIBE_PDF] Initialized PDF generation service");
	}

	/**
	 * Generates a PDF from LaTeX content
	 * @param request - The PDF generation request matching Client Integration Guide spec
	 * @returns The R2 key and filename of the generated PDF
	 * @throws Error if PDF generation fails
	 */
	async generatePdf(
		request: ScribePdfRequest,
	): Promise<ScribePdfSuccessResponse> {
		console.log("🔄 [SCRIBE_PDF] Generating PDF", {
			userId: request.user_id,
			title: request.title,
			contentLength: request.latex_content.length,
		});

		const response = await fetch(`${this.apiUrl}/v1/generate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-KEY": this.apiKey,
			},
			body: JSON.stringify(request),
		});

		const data = (await response.json()) as ScribePdfResponse;

		if (!response.ok) {
			const errorData = data as ScribePdfErrorResponse;
			console.error("❌ [SCRIBE_PDF] PDF generation failed", {
				status: response.status,
				errorCode: errorData.error_code,
				errorMessage: errorData.error_message,
				details: errorData.details,
			});
			throw new Error(
				`PDF generation failed: ${errorData.error_message || "Unknown error"}${
					errorData.details ? ` - ${errorData.details}` : ""
				}`,
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
