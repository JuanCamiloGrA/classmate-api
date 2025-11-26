/**
 * Scribe PDF Generation Service
 * Calls the external SCRIBE_HEAVY_API_URL to compile LaTeX to PDF
 */

export interface ScribePdfRequest {
	/** User ID for path organization */
	user_id: string;
	/** Document title (1-500 chars) */
	titulo: string;
	/** Course name (1-200 chars) */
	curso: string;
	/** Student name (1-200 chars) */
	estudiante: string;
	/** Date string (1-100 chars) */
	fecha: string;
	/** LaTeX body content (10-500000 chars) */
	contenido_latex: string;
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
	 * @param request - The PDF generation request
	 * @returns The R2 key and filename of the generated PDF
	 * @throws Error if PDF generation fails
	 */
	async generatePdf(
		request: ScribePdfRequest,
	): Promise<ScribePdfSuccessResponse> {
		console.log("🔄 [SCRIBE_PDF] Generating PDF", {
			userId: request.user_id,
			titulo: request.titulo,
			contentLength: request.contenido_latex.length,
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
