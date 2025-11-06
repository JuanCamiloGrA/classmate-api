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
			console.log("🔗 [AI] Downloading file from presigned URL", {
				fileUrl,
				mimeType,
			});

			// Download file from presigned URL
			const response = await fetch(fileUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to download file: ${response.status} ${response.statusText}`,
				);
			}

			const blob = await response.blob();

			console.log("📤 [AI] Uploading file to Gemini Files API", {
				size: blob.size,
				mimeType,
			});

			// Upload to Gemini Files API
			const uploaded = await this.client.files.upload({
				file: blob,
				config: { mimeType },
			});

			console.log("✅ [AI] File uploaded to Gemini Files API", {
				uri: (uploaded as any).uri,
			});

			// Generate content using uploaded file
			const contentResponse = await this.client.models.generateContent({
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

			const result = (contentResponse as any).text ?? "";

			// Clean up: delete file from Gemini Files API
			try {
				await this.client.files.delete({ name: (uploaded as any).name });
				console.log("🗑️ [AI] Cleaned up file from Gemini Files API");
			} catch (deleteError) {
				console.warn("⚠️ [AI] Failed to delete file from Gemini Files API", {
					error:
						deleteError instanceof Error
							? deleteError.message
							: String(deleteError),
				});
				// Don't throw - file will auto-delete after 48h
			}

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
