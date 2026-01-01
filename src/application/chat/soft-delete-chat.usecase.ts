/**
 * Soft Delete Chat Use Case
 * Marks a chat as deleted without removing data.
 */

import type { Chat } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";

export interface SoftDeleteChatInput {
	userId: string;
	chatId: string;
}

export interface SoftDeleteChatOutput {
	chat: Chat;
}

/**
 * Use case for soft-deleting a chat conversation.
 */
export class SoftDeleteChatUseCase {
	constructor(private chatRepository: ChatRepository) {}

	async execute(input: SoftDeleteChatInput): Promise<SoftDeleteChatOutput> {
		const chat = await this.chatRepository.softDelete(
			input.userId,
			input.chatId,
		);
		return { chat };
	}
}
