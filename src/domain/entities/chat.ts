/**
 * Chat Domain Entities
 * Defines the core types for chat conversations and messages.
 */

// ============================================
// ENUMS & UNION TYPES
// ============================================

/**
 * Context type for a chat conversation.
 * - global: General chat not tied to specific content
 * - subject: Chat focused on a specific subject
 * - task: Chat focused on a specific task
 * - pdf: Chat focused on a specific PDF document
 */
export type ChatContextType = "global" | "subject" | "task" | "pdf";

/**
 * Role of the message sender.
 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/**
 * Status of a message during streaming/completion.
 */
export type MessageStatus = "streaming" | "complete" | "error";

// ============================================
// CHAT ENTITY
// ============================================

/**
 * Represents a chat conversation session.
 */
export interface Chat {
	id: string;
	userId: string;
	title: string | null;
	lastMessageAt: string | null;
	messageCount: number;
	isPinned: boolean;
	isArchived: boolean;
	model: string | null;
	temperature: number | null;
	contextType: ChatContextType | null;
	contextId: string | null;
	isDeleted: boolean;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Data required to create a new chat.
 */
export interface ChatCreateData {
	/** Optional ID for the chat (for auto-provisioning from DO) */
	id?: string;
	userId: string;
	title?: string | null;
	model?: string | null;
	temperature?: number | null;
	contextType?: ChatContextType | null;
	contextId?: string | null;
}

/**
 * Data that can be updated on a chat.
 */
export interface ChatUpdateData {
	title?: string | null;
	lastMessageAt?: string | null;
	messageCount?: number;
	isPinned?: boolean;
	isArchived?: boolean;
	model?: string | null;
	temperature?: number | null;
}

/**
 * Lightweight chat item for list views.
 */
export interface ChatListItem {
	id: string;
	title: string | null;
	lastMessageAt: string | null;
	messageCount: number;
	isPinned: boolean;
	isArchived: boolean;
	contextType: ChatContextType | null;
	contextId: string | null;
	createdAt: string;
}

// ============================================
// MESSAGE ENTITY
// ============================================

/**
 * Represents a single message in a chat conversation.
 */
export interface Message {
	id: string;
	chatId: string;
	userId: string;
	role: MessageRole;
	sequence: number;
	content: string;
	attachments?: MessageAttachment[];
	status: MessageStatus | null;
	latencyMs: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	errorMessage: string | null;
	toolCalls: string | null;
	createdAt: string;
}

/**
 * Data required to create a new message.
 */
export interface MessageCreateData {
	chatId: string;
	userId: string;
	role: MessageRole;
	sequence: number;
	content: string;
	attachments?: MessageAttachmentCreateData[];
	status?: MessageStatus | null;
	latencyMs?: number | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
	errorMessage?: string | null;
	toolCalls?: string | null;
}

/**
 * Batch of messages to sync from Durable Object to D1.
 * Includes metadata for efficient syncing.
 */
export interface MessageSyncBatch {
	chatId: string;
	userId: string;
	messages: MessageCreateData[];
	/** Last sequence number already synced to D1 */
	lastSyncedSequence: number;
}

export interface MessageAttachment {
	id: string;
	messageId: string;
	chatId: string;
	userId: string;
	r2Key: string;
	thumbnailR2Key: string | null;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
	createdAt: string;
}

export interface MessageAttachmentCreateData {
	messageId: string;
	chatId: string;
	userId: string;
	r2Key: string;
	thumbnailR2Key?: string | null;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
}

/**
 * Chat with its messages included.
 */
export interface ChatWithMessages extends Chat {
	messages: Message[];
}
