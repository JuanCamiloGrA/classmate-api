import type { PromptService } from "../../domain/services/prompt.service";
import type { DevLogger } from "../logging/dev-logger";

const DEFAULT_PROMPT = `You are an assistant that reads a class transcript and returns a concise, well-structured summary. Use markdown with headings, bullet points, and key takeaways. Respond in the original language.`;

/**
 * Prompt Service Adapter
 * Loads prompt from bundled assets via ASSETS binding
 */
export class AssetsPromptService implements PromptService {
	constructor(
		private readonly assetsFetcher?: Fetcher,
		private readonly logger?: DevLogger,
	) {}

	async loadPrompt(): Promise<string> {
		return this.getPrompt("prompt.txt");
	}

	async getPrompt(path: string): Promise<string> {
		if (!this.assetsFetcher) {
			return DEFAULT_PROMPT;
		}

		try {
			// Ensure path doesn't start with / to avoid double slashes if we were concatenating
			// But here we use a full URL for the fetcher
			const url = `http://assets/${path}`;
			const response = await this.assetsFetcher.fetch(new Request(url));

			if (!response.ok) {
				return DEFAULT_PROMPT;
			}

			const promptText = await response.text();
			this.logger?.log("PROMPT", `Prompt ${path} loaded`, {
				length: promptText.length,
			});
			return promptText;
		} catch (error) {
			return DEFAULT_PROMPT;
		}
	}
}
