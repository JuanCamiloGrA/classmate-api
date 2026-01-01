/**
 * Update Chat Use Case
 * Updates chat metadata like title, pinned, archived status.
 */

import type { Chat } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";

export interface UpdateChatData {
	title?: string | null;
	isPinned?: boolean;
	isArchived?: boolean;
}

export interface UpdateChatInput {
	userId: string;
	chatId: string;
	data: UpdateChatData;
}

export interface UpdateChatOutput {
	chat: Chat;
}

/**
 * Use case for updating chat metadata.
 */
export class UpdateChatUseCase {
	constructor(private chatRepository: ChatRepository) {}

	async execute(input: UpdateChatInput): Promise<UpdateChatOutput> {
		const { userId, chatId, data } = input;
		const chat = await this.chatRepository.update(userId, chatId, data);
		return { chat };
	}
}
