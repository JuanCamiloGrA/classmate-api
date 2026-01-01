/**
 * Sync Messages Use Case
 * Synchronizes messages from Durable Object to D1 database.
 * Called by the agent's alarm handler for batched writes.
 */

import type { MessageSyncBatch } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { ChatTitleGenerator } from "../../domain/services/chat-title.service";

export interface SyncMessagesInput {
	batch: MessageSyncBatch;
}

export interface SyncMessagesOutput {
	synced: number;
	chatId: string;
	/** True if this was the first sync (chat title may have been generated) */
	isFirstSync: boolean;
}

/**
 * Use case for syncing messages from Durable Object to D1.
 * Handles batched writes and optional title generation.
 */
export class SyncMessagesUseCase {
	constructor(
		private chatRepository: ChatRepository,
		private titleGenerator?: ChatTitleGenerator,
	) {}

	async execute(input: SyncMessagesInput): Promise<SyncMessagesOutput> {
		const { batch } = input;
		const isFirstSync = batch.lastSyncedSequence === 0;

		// Sync messages to D1
		const synced = await this.chatRepository.syncMessages(batch);

		// Generate title from first user message if this is first sync
		if (isFirstSync && this.titleGenerator && synced > 0) {
			const firstUserMessage = batch.messages.find((m) => m.role === "user");
			if (firstUserMessage) {
				const title = this.titleGenerator.generate(firstUserMessage.content);
				await this.chatRepository.update(batch.userId, batch.chatId, { title });
			}
		}

		return {
			synced,
			chatId: batch.chatId,
			isFirstSync,
		};
	}
}
