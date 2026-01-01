/**
 * D1 Chat Repository Implementation
 * Handles chat and message persistence using Drizzle ORM.
 */

import { and, asc, count, desc, eq, gt, like, max } from "drizzle-orm";
import type {
	Chat,
	ChatContextType,
	ChatCreateData,
	ChatListItem,
	ChatUpdateData,
	ChatWithMessages,
	Message,
	MessageSyncBatch,
} from "../../../domain/entities/chat";
import type {
	ChatFilters,
	ChatListResult,
	ChatRepository,
} from "../../../domain/repositories/chat.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { chats, messages } from "../schema";

/**
 * D1 implementation of the ChatRepository interface.
 * Optimized for batched message syncing from Durable Objects.
 */
export class D1ChatRepository implements ChatRepository {
	constructor(private db: Database) {}

	// ============================================
	// CHAT OPERATIONS
	// ============================================

	async create(data: ChatCreateData): Promise<Chat> {
		const id = data.id ?? crypto.randomUUID();
		const now = new Date().toISOString();

		const newChat = await this.db
			.insert(chats)
			.values({
				id,
				userId: data.userId,
				title: data.title ?? null,
				model: data.model ?? null,
				temperature: data.temperature ?? null,
				contextType: data.contextType ?? null,
				contextId: data.contextId ?? null,
				lastMessageAt: null,
				messageCount: 0,
				isPinned: 0,
				isArchived: 0,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!newChat) {
			throw new Error("Failed to create chat");
		}

		return this.mapToChat(newChat);
	}

	async findById(userId: string, chatId: string): Promise<Chat | null> {
		const chat = await this.db
			.select()
			.from(chats)
			.where(
				and(
					eq(chats.id, chatId),
					eq(chats.userId, userId),
					eq(chats.isDeleted, 0),
				),
			)
			.get();

		return chat ? this.mapToChat(chat) : null;
	}

	async findByIdWithMessages(
		userId: string,
		chatId: string,
	): Promise<ChatWithMessages | null> {
		const chat = await this.findById(userId, chatId);
		if (!chat) return null;

		const chatMessages = await this.db
			.select()
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.orderBy(asc(messages.sequence));

		return {
			...chat,
			messages: chatMessages.map(this.mapToMessage),
		};
	}

	async findAllByUserId(
		userId: string,
		filters: ChatFilters,
	): Promise<ChatListResult> {
		const conditions = [eq(chats.userId, userId), eq(chats.isDeleted, 0)];

		if (typeof filters.isArchived === "boolean") {
			conditions.push(eq(chats.isArchived, filters.isArchived ? 1 : 0));
		}

		if (typeof filters.isPinned === "boolean") {
			conditions.push(eq(chats.isPinned, filters.isPinned ? 1 : 0));
		}

		if (filters.contextType) {
			conditions.push(
				eq(chats.contextType, filters.contextType as ChatContextType),
			);
		}

		if (filters.contextId) {
			conditions.push(eq(chats.contextId, filters.contextId));
		}

		if (filters.search) {
			conditions.push(like(chats.title, `%${filters.search}%`));
		}

		const whereClause = and(...conditions);

		// Get total count
		const totalResult = await this.db
			.select({ count: count() })
			.from(chats)
			.where(whereClause)
			.get();

		const total = totalResult?.count ?? 0;

		// Build query with sorting and pagination
		let query = this.db
			.select({
				id: chats.id,
				title: chats.title,
				lastMessageAt: chats.lastMessageAt,
				messageCount: chats.messageCount,
				isPinned: chats.isPinned,
				isArchived: chats.isArchived,
				contextType: chats.contextType,
				contextId: chats.contextId,
				createdAt: chats.createdAt,
			})
			.from(chats)
			.where(whereClause)
			.$dynamic();

		// Sort by pinned first, then by lastMessageAt (newest first by default)
		query =
			filters.sortOrder === "asc"
				? query.orderBy(desc(chats.isPinned), asc(chats.lastMessageAt))
				: query.orderBy(desc(chats.isPinned), desc(chats.lastMessageAt));

		if (filters.limit) {
			query = query.limit(filters.limit);
		}
		if (filters.offset) {
			query = query.offset(filters.offset);
		}

		const data = await query;

		return {
			data: data.map((item) => ({
				...item,
				isPinned: item.isPinned === 1,
				isArchived: item.isArchived === 1,
			})) as ChatListItem[],
			total,
		};
	}

	async update(
		userId: string,
		chatId: string,
		data: ChatUpdateData,
	): Promise<Chat> {
		const existing = await this.findById(userId, chatId);
		if (!existing) {
			throw new NotFoundError("Chat not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = { updatedAt: now };

		if (data.title !== undefined) updatePayload.title = data.title;
		if (data.lastMessageAt !== undefined)
			updatePayload.lastMessageAt = data.lastMessageAt;
		if (data.messageCount !== undefined)
			updatePayload.messageCount = data.messageCount;
		if (data.isPinned !== undefined)
			updatePayload.isPinned = data.isPinned ? 1 : 0;
		if (data.isArchived !== undefined)
			updatePayload.isArchived = data.isArchived ? 1 : 0;
		if (data.model !== undefined) updatePayload.model = data.model;
		if (data.temperature !== undefined)
			updatePayload.temperature = data.temperature;

		const updated = await this.db
			.update(chats)
			.set(updatePayload)
			.where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update chat");
		}

		return this.mapToChat(updated);
	}

	async softDelete(userId: string, chatId: string): Promise<Chat> {
		const existing = await this.findById(userId, chatId);
		if (!existing) {
			throw new NotFoundError("Chat not found");
		}

		const now = new Date().toISOString();

		const deleted = await this.db
			.update(chats)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
			.returning()
			.get();

		if (!deleted) {
			throw new NotFoundError("Failed to delete chat");
		}

		return this.mapToChat(deleted);
	}

	async restore(userId: string, chatId: string): Promise<Chat> {
		const now = new Date().toISOString();

		const restored = await this.db
			.update(chats)
			.set({
				isDeleted: 0,
				deletedAt: null,
				updatedAt: now,
			})
			.where(
				and(
					eq(chats.id, chatId),
					eq(chats.userId, userId),
					eq(chats.isDeleted, 1),
				),
			)
			.returning()
			.get();

		if (!restored) {
			throw new NotFoundError("Chat not found or not deleted");
		}

		return this.mapToChat(restored);
	}

	// ============================================
	// MESSAGE OPERATIONS
	// ============================================

	async getMessages(
		userId: string,
		chatId: string,
		limit = 100,
		afterSequence = 0,
	): Promise<Message[]> {
		// Verify chat ownership
		const chatExists = await this.exists(userId, chatId);
		if (!chatExists) {
			throw new NotFoundError("Chat not found");
		}

		const result = await this.db
			.select()
			.from(messages)
			.where(
				and(eq(messages.chatId, chatId), gt(messages.sequence, afterSequence)),
			)
			.orderBy(asc(messages.sequence))
			.limit(limit);

		return result.map(this.mapToMessage);
	}

	async getLastSequence(chatId: string): Promise<number> {
		const result = await this.db
			.select({ maxSeq: max(messages.sequence) })
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.get();

		return result?.maxSeq ?? 0;
	}

	async syncMessages(batch: MessageSyncBatch): Promise<number> {
		const { chatId, messages: newMessages, lastSyncedSequence } = batch;

		// Filter only messages that haven't been synced yet
		const messagesToInsert = newMessages.filter(
			(m) => m.sequence > lastSyncedSequence,
		);

		if (messagesToInsert.length === 0) {
			return 0;
		}

		const now = new Date().toISOString();

		// NOTE: Avoiding db.transaction() due to D1 + Durable Objects local dev issue.
		// Idempotency is achieved via unique(chat_id, sequence) + onConflictDoNothing.
		// This ensures retries won't create duplicates even if the previous attempt
		// partially succeeded.

		// Insert messages in batch (ignore duplicates on retry)
		const insertedMessages = await this.db
			.insert(messages)
			.values(
				messagesToInsert.map((m) => ({
					id: crypto.randomUUID(),
					chatId: m.chatId,
					userId: m.userId,
					role: m.role,
					sequence: m.sequence,
					content: m.content,
					status: m.status ?? null,
					latencyMs: m.latencyMs ?? null,
					inputTokens: m.inputTokens ?? null,
					outputTokens: m.outputTokens ?? null,
					errorMessage: m.errorMessage ?? null,
					toolCalls: m.toolCalls ?? null,
					createdAt: now,
				})),
			)
			.onConflictDoNothing()
			.returning({ sequence: messages.sequence });

		// Compute sync position so retries can still advance the DO cursor.
		// Fast path: when no conflicts happened, we can derive the last sequence from RETURNING.
		// Slow path: if conflicts occurred (likely retry/partial success), query DB for the truth.
		let lastSequenceInDb: number;
		if (insertedMessages.length === messagesToInsert.length) {
			const maxInsertedSequence = insertedMessages.reduce(
				(maxSeq, row) => (row.sequence > maxSeq ? row.sequence : maxSeq),
				lastSyncedSequence,
			);
			lastSequenceInDb = Math.max(lastSyncedSequence, maxInsertedSequence);
		} else {
			lastSequenceInDb = await this.getLastSequence(chatId);
		}

		const synced = Math.max(0, lastSequenceInDb - lastSyncedSequence);

		// Update chat metadata
		await this.db
			.update(chats)
			.set({
				lastMessageAt: now,
				messageCount: lastSequenceInDb,
				updatedAt: now,
			})
			.where(eq(chats.id, chatId));

		return synced;
	}

	// ============================================
	// UTILITY OPERATIONS
	// ============================================

	async exists(userId: string, chatId: string): Promise<boolean> {
		const result = await this.db
			.select({ count: count() })
			.from(chats)
			.where(
				and(
					eq(chats.id, chatId),
					eq(chats.userId, userId),
					eq(chats.isDeleted, 0),
				),
			)
			.get();

		return (result?.count ?? 0) > 0;
	}

	async countByUserId(userId: string, includeDeleted = false): Promise<number> {
		const conditions = [eq(chats.userId, userId)];

		if (!includeDeleted) {
			conditions.push(eq(chats.isDeleted, 0));
		}

		const result = await this.db
			.select({ count: count() })
			.from(chats)
			.where(and(...conditions))
			.get();

		return result?.count ?? 0;
	}

	// ============================================
	// PRIVATE HELPERS
	// ============================================

	private mapToChat(row: typeof chats.$inferSelect): Chat {
		return {
			id: row.id,
			userId: row.userId,
			title: row.title,
			lastMessageAt: row.lastMessageAt,
			messageCount: row.messageCount ?? 0,
			isPinned: row.isPinned === 1,
			isArchived: row.isArchived === 1,
			model: row.model,
			temperature: row.temperature,
			contextType: row.contextType as Chat["contextType"],
			contextId: row.contextId,
			isDeleted: row.isDeleted === 1,
			deletedAt: row.deletedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	private mapToMessage(row: typeof messages.$inferSelect): Message {
		return {
			id: row.id,
			chatId: row.chatId,
			userId: row.userId,
			role: row.role as Message["role"],
			sequence: row.sequence,
			content: row.content,
			status: row.status as Message["status"],
			latencyMs: row.latencyMs,
			inputTokens: row.inputTokens,
			outputTokens: row.outputTokens,
			errorMessage: row.errorMessage,
			toolCalls: row.toolCalls,
			createdAt: row.createdAt,
		};
	}
}
