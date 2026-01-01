/**
 * AI-powered Chat Title Generator
 * Uses a small, fast model (gemini-2.5-flash-lite) to generate
 * concise chat titles based on the first user message.
 */

import { createGateway, generateText } from "ai"; // vercel/ai SDK
import type { AsyncChatTitleGenerator } from "../../domain/services/chat-title.service";
import {
	DEFAULT_CHAT_TITLE,
	SimpleChatTitleGenerator,
} from "../../domain/services/chat-title.service";

const MAX_TITLE_LENGTH = 50;
const MAX_INPUT_CONTENT = 500;
const TITLE_MAX_OUTPUT_TOKENS = 30;
const DEFAULT_TITLE_MODEL_ID =
	(process.env.CHAT_TITLE_MODEL_ID as string | undefined) ??
	("google/gemini-2.5-flash-lite" as const);

function buildTitlePrompt(message: string): string {
	return `Generate a very short chat title (max ${MAX_TITLE_LENGTH} characters) for this message.
Rules:
- Use the SAME LANGUAGE as the message
- Be concise and descriptive
- No quotes or special formatting
- Just output the title, nothing else

Message: "${message}"`;
}

/**
 * AI-based title generator using Gemini 2.5 Flash Lite.
 * Generates short, contextual titles in the same language as the input.
 */
export class AIChatTitleGenerator implements AsyncChatTitleGenerator {
	private gateway: ReturnType<typeof createGateway>;
	private fallback: SimpleChatTitleGenerator;

	constructor(apiKey: string) {
		this.gateway = createGateway({ apiKey });
		this.fallback = new SimpleChatTitleGenerator(MAX_TITLE_LENGTH);
	}

	async generateAsync(content: string): Promise<string> {
		const cleaned = content.trim();

		if (!cleaned) {
			return DEFAULT_CHAT_TITLE;
		}

		try {
			const model = this.gateway(DEFAULT_TITLE_MODEL_ID);

			const truncatedContent = cleaned.slice(0, MAX_INPUT_CONTENT);

			const { text } = await generateText({
				model,
				messages: [
					{
						role: "user",
						content: buildTitlePrompt(truncatedContent),
					},
				],
				maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
			});

			const title = text.trim().replace(/^["']|["']$/g, "");

			if (!title || title.length === 0) {
				return this.fallback.generate(content);
			}

			// Ensure max length
			if (title.length > MAX_TITLE_LENGTH) {
				return `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`;
			}

			return title;
		} catch (error) {
			const safeErrorInfo =
				error instanceof Error
					? `${error.name}: ${error.message}`
					: String(error);
			console.error(
				"[AIChatTitleGenerator] Error generating title:",
				safeErrorInfo,
			);
			// Fallback to simple truncation on AI failure
			return this.fallback.generate(content);
		}
	}
}
