/**
 * AI Service Interface (Port)
 * Defines contract for AI content generation services
 */
export interface AIService {
	generateContent(
		prompt: string,
		content: Uint8Array | string,
		isAudio: boolean,
		mimeType?: string,
	): Promise<string>;

	generateSummaryFromUrl(
		prompt: string,
		fileUrl: string,
		mimeType: string,
	): Promise<string>;
}
