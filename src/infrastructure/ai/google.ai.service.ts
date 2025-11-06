/** biome-ignore-all lint/suspicious/noExplicitAny: Using 'any' for Google GenAI SDK responses due to incomplete type definitions in the library. */
import {
	createPartFromUri,
	createUserContent,
	GoogleGenAI,
} from "@google/genai";
import type { AIService } from "../../domain/services/ai.service";

const AI_CONFIG = {
	model: "gemini-flash-lite-latest",
	thinkingBudget: 4000,
} as const;

/**
 * Google AI Service Adapter
 * Implements AIService using Google GenAI SDK
 */
export class GoogleAIService implements AIService {
	private client: GoogleGenAI;

	constructor(apiKey: string) {
		this.client = new GoogleGenAI({
			apiKey,
		});
		console.log("🚀 [AI_CLIENT] Initialized Google AI client");
	}

	async generateContent(
		prompt: string,
		content: Uint8Array | string,
		isAudio: boolean,
		mimeType?: string,
	): Promise<string> {
		try {
			if (isAudio && mimeType) {
				return await this.processAudioContent(prompt, content, mimeType);
			}
			return await this.processTextContent(prompt, content);
		} catch (e) {
			console.error("❌ [AI] Gemini request failed", {
				error: e instanceof Error ? e.message : String(e),
				model: AI_CONFIG.model,
			});
			throw e;
		}
	}

	private async processAudioContent(
		prompt: string,
		content: Uint8Array | string,
		mimeType: string,
	): Promise<string> {
		console.log("🎵 [AI] Processing audio with Gemini");
		const bytes =
			typeof content === "string" ? new TextEncoder().encode(content) : content;
		const blob = new Blob([bytes], { type: mimeType });
		const uploaded = await this.client.files.upload({
			file: blob,
			config: { mimeType },
		});

		const response = await this.client.models.generateContent({
			model: AI_CONFIG.model,
			contents: createUserContent([
				createPartFromUri(
					(uploaded as any).uri,
					(uploaded as any).mimeType || mimeType,
				),
				prompt,
			]),
			config: {
				thinkingConfig: { thinkingBudget: AI_CONFIG.thinkingBudget },
			},
		});

		return (response as any).text ?? "";
	}

	private async processTextContent(
		prompt: string,
		content: Uint8Array | string,
	): Promise<string> {
		console.log("📄 [AI] Processing text with Gemini");
		const text =
			typeof content === "string" ? content : new TextDecoder().decode(content);
		const wrapped = `<class_content>${text}</class_content>`;
		const response = await this.client.models.generateContent({
			model: AI_CONFIG.model,
			contents: createUserContent([prompt, wrapped]),
			config: {
				thinkingConfig: { thinkingBudget: AI_CONFIG.thinkingBudget },
			},
		});

		return (response as any).text ?? "";
	}

	async generateSummaryFromUrl(
		prompt: string,
		fileUrl: string,
		mimeType: string,
	): Promise<string> {
		try {
			console.log("🔗 [AI] Processing file from URL with Gemini", {
				fileUrl,
				mimeType,
			});

			const response = await this.client.models.generateContent({
				model: AI_CONFIG.model,
				contents: createUserContent([
					createPartFromUri(fileUrl, mimeType),
					prompt,
				]),
				config: {
					thinkingConfig: { thinkingBudget: AI_CONFIG.thinkingBudget },
				},
			});

			const result = (response as any).text ?? "";

			console.log("✅ [AI] Summary generated from URL successfully", {
				summaryLength: result.length,
			});

			return result;
		} catch (e) {
			console.error("❌ [AI] Gemini request failed for URL", {
				error: e instanceof Error ? e.message : String(e),
				model: AI_CONFIG.model,
				fileUrl,
			});
			throw e;
		}
	}
}
