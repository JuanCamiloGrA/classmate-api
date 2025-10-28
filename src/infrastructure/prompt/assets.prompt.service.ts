import type { PromptService } from "../../domain/services/prompt.service";

const DEFAULT_PROMPT = `You are an assistant that reads a class transcript and returns a concise, well-structured summary. Use markdown with headings, bullet points, and key takeaways. Respond in the original language.`;

/**
 * Prompt Service Adapter
 * Loads prompt from bundled assets via ASSETS binding
 */
export class AssetsPromptService implements PromptService {
	constructor(private readonly assetsFetcher?: Fetcher) {}

	async loadPrompt(): Promise<string> {
		if (!this.assetsFetcher) {
			console.warn(
				"⚠️ [PROMPT] ASSETS binding not available, using default prompt",
			);
			return DEFAULT_PROMPT;
		}

		try {
			console.log("📝 [PROMPT] Loading prompt from ASSETS");
			const response = await this.assetsFetcher.fetch(
				new Request("http://assets/prompt.txt"),
			);

			if (!response.ok) {
				console.warn(
					"⚠️ [PROMPT] prompt.txt not found in ASSETS, using default",
				);
				return DEFAULT_PROMPT;
			}

			const promptText = await response.text();
			console.log("✅ [PROMPT] Prompt loaded from ASSETS successfully", {
				length: promptText.length,
			});
			return promptText;
		} catch (error) {
			console.warn(
				"⚠️ [PROMPT] Failed to load prompt from ASSETS, using default",
				error,
			);
			return DEFAULT_PROMPT;
		}
	}
}
