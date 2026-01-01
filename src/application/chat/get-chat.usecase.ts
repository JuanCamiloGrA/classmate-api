/**
 * Get Chat Use Case
 * Retrieves a single chat with its messages.
 */

import type { ChatWithMessages } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";

export interface GetChatInput {
	userId: string;
	chatId: string;
	/** If true, include messages in response */
	includeMessages?: boolean;
}

export interface GetChatOutput {
	chat: ChatWithMessages;
}

/**
 * Use case for retrieving a single chat conversation.
 */
export class GetChatUseCase {
	constructor(private chatRepository: ChatRepository) {}

	async execute(input: GetChatInput): Promise<GetChatOutput | null> {
		const { userId, chatId, includeMessages = true } = input;

		if (includeMessages) {
			const chat = await this.chatRepository.findByIdWithMessages(
				userId,
				chatId,
			);
			if (!chat) return null;
			return { chat };
		}

		const chat = await this.chatRepository.findById(userId, chatId);
		if (!chat) return null;

		return {
			chat: { ...chat, messages: [] },
		};
	}
}
