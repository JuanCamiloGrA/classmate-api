/**
 * Chat Title Generator Service Interface
 * Defines the contract for generating chat titles from messages.
 *
 * This interface allows for easy swapping of implementations:
 * - Simple truncation (sync)
 * - AI-generated titles (async)
 */

export const DEFAULT_CHAT_TITLE = "New Chat";

/**
 * Interface for synchronous chat title generation strategies.
 */
export interface ChatTitleGenerator {
	/**
	 * Generate a title from message content (sync).
	 * @param content - The message content (usually first user message)
	 * @returns Generated title string
	 */
	generate(content: string): string;
}

/**
 * Interface for async chat title generation (e.g., AI-based).
 */
export interface AsyncChatTitleGenerator {
	/**
	 * Generate a title from message content using AI.
	 * @param content - The message content (usually first user message)
	 * @returns Promise resolving to generated title string
	 */
	generateAsync(content: string): Promise<string>;
}

/**
 * Simple title generator that truncates the first message.
 * Extracts the first sentence or truncates at a max length.
 */
export class SimpleChatTitleGenerator implements ChatTitleGenerator {
	private readonly maxLength: number;

	constructor(maxLength = 50) {
		this.maxLength = maxLength;
	}

	generate(content: string): string {
		// Clean up whitespace
		const cleaned = content.trim().replace(/\s+/g, " ");

		if (!cleaned) {
			return DEFAULT_CHAT_TITLE;
		}

		// Try to extract first sentence (ending with . ! ?)
		const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]/);
		if (sentenceMatch && sentenceMatch[0].length <= this.maxLength) {
			return sentenceMatch[0].trim();
		}

		// If no sentence found or too long, truncate at word boundary
		if (cleaned.length <= this.maxLength) {
			return cleaned;
		}

		// Find last space before maxLength
		const truncated = cleaned.slice(0, this.maxLength);
		const lastSpace = truncated.lastIndexOf(" ");

		if (lastSpace > this.maxLength * 0.5) {
			return `${truncated.slice(0, lastSpace)}...`;
		}

		return `${truncated}...`;
	}
}
