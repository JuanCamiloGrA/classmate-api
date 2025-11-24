import { createGateway, generateText, type ModelMessage } from "ai";
import type { AIService } from "../../domain/services/ai.service";

export class VercelAIService implements AIService {
	private gateway: ReturnType<typeof createGateway>;

	constructor(apiKey: string) {
		this.gateway = createGateway({
			apiKey,
		});
	}

	async generateContent(
		prompt: string,
		binaryContent?: string,
		isPdf = false,
	): Promise<string> {
		const model = this.gateway("google/gemini-2.5-flash-lite");

		const messages: ModelMessage[] = [
			{
				role: "user",
				content: [
					{ type: "text", text: prompt },
					...(binaryContent
						? [
								{
									type: "file" as const,
									data: binaryContent,
									mediaType: isPdf ? "application/pdf" : "audio/mp3",
								},
							]
						: []),
				],
			},
		];

		const { text } = await generateText({
			model,
			messages,
		});

		return text;
	}

	async generateSummaryFromUrl(
		prompt: string,
		fileUrl: string,
		mimeType: string,
	): Promise<string> {
		const model = this.gateway("google/gemini-2.5-flash-lite");

		// Pass URL directly to avoid downloading in the worker and Buffer issues
		const { text } = await generateText({
			model,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: prompt },
						{ type: "file", data: new URL(fileUrl), mediaType: mimeType },
					],
				},
			],
		});

		return text;
	}
}
