/**
 * Chat Repository Interface
 * Defines the contract for chat and message persistence operations.
 */

import type {
	Chat,
	ChatCreateData,
	ChatListItem,
	ChatUpdateData,
	ChatWithMessages,
	Message,
	MessageSyncBatch,
} from "../entities/chat";

// ============================================
// FILTER TYPES
// ============================================

export interface ChatFilters {
	/** Filter by archived status */
	isArchived?: boolean;
	/** Filter by pinned status */
	isPinned?: boolean;
	/** Filter by context type */
	contextType?: string;
	/** Filter by context ID (e.g., specific subject) */
	contextId?: string;
	/** Search in title */
	search?: string;
	/** Pagination limit */
	limit?: number;
	/** Pagination offset */
	offset?: number;
	/** Sort order by last message */
	sortOrder?: "asc" | "desc";
}

export interface ChatListResult {
	data: ChatListItem[];
	total: number;
}

// ============================================
// REPOSITORY INTERFACE
// ============================================

/**
 * Repository interface for chat persistence operations.
 * Handles both chat sessions and their messages.
 */
export interface ChatRepository {
	// ============================================
	// CHAT OPERATIONS
	// ============================================

	/**
	 * Create a new chat conversation.
	 * @param data - Chat creation data
	 * @returns The created chat
	 */
	create(data: ChatCreateData): Promise<Chat>;

	/**
	 * Find a chat by ID for a specific user.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to find
	 * @returns Chat if found and not deleted, null otherwise
	 */
	findById(userId: string, chatId: string): Promise<Chat | null>;

	/**
	 * Find a chat with all its messages.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to find
	 * @returns Chat with messages if found, null otherwise
	 */
	findByIdWithMessages(
		userId: string,
		chatId: string,
	): Promise<ChatWithMessages | null>;

	/**
	 * List all chats for a user with filtering and pagination.
	 * @param userId - Owner user ID
	 * @param filters - Filter and pagination options
	 * @returns Paginated list of chats
	 */
	findAllByUserId(
		userId: string,
		filters: ChatFilters,
	): Promise<ChatListResult>;

	/**
	 * Update chat metadata.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to update
	 * @param data - Update data
	 * @returns Updated chat
	 */
	update(userId: string, chatId: string, data: ChatUpdateData): Promise<Chat>;

	/**
	 * Soft delete a chat (set isDeleted flag).
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to delete
	 * @returns The soft-deleted chat
	 */
	softDelete(userId: string, chatId: string): Promise<Chat>;

	/**
	 * Restore a soft-deleted chat.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to restore
	 * @returns The restored chat
	 */
	restore(userId: string, chatId: string): Promise<Chat>;

	// ============================================
	// MESSAGE OPERATIONS
	// ============================================

	/**
	 * Get messages for a chat with pagination.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID
	 * @param limit - Max messages to return
	 * @param afterSequence - Get messages after this sequence number
	 * @returns Array of messages
	 */
	getMessages(
		userId: string,
		chatId: string,
		limit?: number,
		afterSequence?: number,
	): Promise<Message[]>;

	/**
	 * Get the highest sequence number for a chat.
	 * Used for sync operations.
	 * @param chatId - Chat ID
	 * @returns Highest sequence number, or 0 if no messages
	 */
	getLastSequence(chatId: string): Promise<number>;

	/**
	 * Sync messages from Durable Object to D1 in batch.
	 * Only inserts messages with sequence > lastSyncedSequence.
	 * Updates chat metadata (lastMessageAt, messageCount).
	 * @param batch - Batch of messages to sync
	 * @returns Number of messages inserted
	 */
	syncMessages(batch: MessageSyncBatch): Promise<number>;

	// ============================================
	// UTILITY OPERATIONS
	// ============================================

	/**
	 * Check if a chat exists and belongs to user.
	 * @param userId - Owner user ID
	 * @param chatId - Chat ID to check
	 * @returns True if exists and not deleted
	 */
	exists(userId: string, chatId: string): Promise<boolean>;

	/**
	 * Get total chat count for a user.
	 * @param userId - Owner user ID
	 * @param includeDeleted - Include soft-deleted chats
	 * @returns Total count
	 */
	countByUserId(userId: string, includeDeleted?: boolean): Promise<number>;
}
