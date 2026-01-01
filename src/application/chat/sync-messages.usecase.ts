/**
 * Sync Messages Use Case
 * Synchronizes messages from Durable Object to D1 database.
 * Called by the agent's alarm handler for batched writes.
 */

import type { MessageSyncBatch } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { AsyncChatTitleGenerator } from "../../domain/services/chat-title.service";
import { DEFAULT_CHAT_TITLE } from "../../domain/services/chat-title.service";

export interface SyncMessagesInput {
	batch: MessageSyncBatch;
}

export interface SyncMessagesOutput {
	synced: number;
	chatId: string;
	/** True if this was the first sync (chat title may have been generated) */
	isFirstSync: boolean;
	/** Generated title if title was generated */
	generatedTitle?: string;
}

/**
 * Use case for syncing messages from Durable Object to D1.
 * Handles batched writes and AI-powered title generation.
 */
export class SyncMessagesUseCase {
	constructor(
		private chatRepository: ChatRepository,
		private titleGenerator?: AsyncChatTitleGenerator,
	) {}

	async execute(input: SyncMessagesInput): Promise<SyncMessagesOutput> {
		const { batch } = input;
		const isFirstSync = batch.lastSyncedSequence === 0;

		// Sync messages to D1
		const synced = await this.chatRepository.syncMessages(batch);

		let generatedTitle: string | undefined;

		// Generate title if we have a title generator and messages were synced
		if (this.titleGenerator && synced > 0) {
			// Check if chat already has a title
			const chat = await this.chatRepository.findById(
				batch.userId,
				batch.chatId,
			);

			// If the chat cannot be loaded, we cannot safely update its title.
			if (!chat) {
				// Log this as a data consistency issue to aid debugging.
				console.error(
					"SyncMessagesUseCase: Chat not found after successful message sync",
					{
						userId: batch.userId,
						chatId: batch.chatId,
						synced,
						isFirstSync,
						lastSyncedSequence: batch.lastSyncedSequence,
					},
				);
				return {
					synced,
					chatId: batch.chatId,
					isFirstSync,
					generatedTitle,
				};
			}

			const needsTitle = !chat.title || chat.title === DEFAULT_CHAT_TITLE;

			if (needsTitle) {
				// Find the first user message to generate title from
				const firstUserMessage = batch.messages.find((m) => m.role === "user");
				if (firstUserMessage) {
					generatedTitle = await this.titleGenerator.generateAsync(
						firstUserMessage.content,
					);
					await this.chatRepository.update(batch.userId, batch.chatId, {
						title: generatedTitle,
					});
				}
			}
		}

		return {
			synced,
			chatId: batch.chatId,
			isFirstSync,
			generatedTitle,
		};
	}
}
