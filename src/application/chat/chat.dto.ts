/**
 * Chat DTOs
 * Data Transfer Objects for chat API requests and responses.
 */

import { z } from "zod";

// ============================================
// SHARED SCHEMAS
// ============================================

export const chatContextTypeSchema = z.enum([
	"global",
	"subject",
	"task",
	"pdf",
]);
export const messageRoleSchema = z.enum([
	"user",
	"assistant",
	"system",
	"tool",
]);
export const messageStatusSchema = z.enum(["streaming", "complete", "error"]);

// ============================================
// REQUEST DTOs
// ============================================

/**
 * Request to create a new chat session.
 */
export const createChatRequestSchema = z.object({
	title: z.string().max(200).optional().nullable(),
	model: z.string().max(100).optional().nullable(),
	temperature: z.number().min(0).max(2).optional().nullable(),
	contextType: chatContextTypeSchema.optional().nullable(),
	contextId: z.string().uuid().optional().nullable(),
});

export type CreateChatRequest = z.infer<typeof createChatRequestSchema>;

/**
 * Request to update chat metadata.
 */
export const updateChatRequestSchema = z.object({
	title: z.string().max(200).optional().nullable(),
	isPinned: z.boolean().optional(),
	isArchived: z.boolean().optional(),
});

export type UpdateChatRequest = z.infer<typeof updateChatRequestSchema>;

/**
 * Query parameters for listing chats.
 */
export const listChatsQuerySchema = z.object({
	isArchived: z.coerce.boolean().optional(),
	isPinned: z.coerce.boolean().optional(),
	contextType: chatContextTypeSchema.optional(),
	contextId: z.string().uuid().optional(),
	search: z.string().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListChatsQuery = z.infer<typeof listChatsQuerySchema>;

/**
 * Request to sync messages from Durable Object to D1.
 * Called internally by the agent's alarm handler.
 */
export const syncMessagesRequestSchema = z.object({
	chatId: z.string().uuid(),
	userId: z.string(),
	lastSyncedSequence: z.number().int().min(0),
	messages: z.array(
		z.object({
			chatId: z.string().uuid(),
			userId: z.string(),
			role: messageRoleSchema,
			sequence: z.number().int().min(1),
			content: z.string(),
			attachments: z
				.array(
					z.object({
						r2Key: z.string(),
						thumbnailR2Key: z.string().nullable().optional(),
						originalFilename: z.string(),
						mimeType: z.string(),
						sizeBytes: z.number().int().nonnegative(),
					}),
				)
				.optional(),
			status: messageStatusSchema.optional().nullable(),
			latencyMs: z.number().int().optional().nullable(),
			inputTokens: z.number().int().optional().nullable(),
			outputTokens: z.number().int().optional().nullable(),
			errorMessage: z.string().optional().nullable(),
			toolCalls: z.string().optional().nullable(),
		}),
	),
});

export type SyncMessagesRequest = z.infer<typeof syncMessagesRequestSchema>;

// ============================================
// RESPONSE DTOs
// ============================================

/**
 * Chat list item response.
 */
export const chatListItemResponseSchema = z.object({
	id: z.string().uuid(),
	title: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	messageCount: z.number().int(),
	isPinned: z.boolean(),
	isArchived: z.boolean(),
	contextType: chatContextTypeSchema.nullable(),
	contextId: z.string().nullable(),
	createdAt: z.string(),
});

export type ChatListItemResponse = z.infer<typeof chatListItemResponseSchema>;

/**
 * Chat list response with pagination.
 */
export const chatListResponseSchema = z.object({
	data: z.array(chatListItemResponseSchema),
	total: z.number().int(),
	limit: z.number().int(),
	offset: z.number().int(),
});

export type ChatListResponse = z.infer<typeof chatListResponseSchema>;

/**
 * Full chat response.
 */
export const chatResponseSchema = z.object({
	id: z.string().uuid(),
	userId: z.string(),
	title: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	messageCount: z.number().int(),
	isPinned: z.boolean(),
	isArchived: z.boolean(),
	model: z.string().nullable(),
	temperature: z.number().nullable(),
	contextType: chatContextTypeSchema.nullable(),
	contextId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

/**
 * Message response.
 */
export const messageResponseSchema = z.object({
	id: z.string().uuid(),
	chatId: z.string().uuid(),
	role: messageRoleSchema,
	sequence: z.number().int(),
	content: z.string(),
	attachments: z
		.array(
			z.object({
				id: z.string().uuid(),
				r2Key: z.string(),
				thumbnailR2Key: z.string().nullable(),
				originalFilename: z.string(),
				mimeType: z.string(),
				sizeBytes: z.number().int(),
				expiresAt: z.string().nullable().optional(),
				url: z.string().nullable().optional(),
				thumbnailUrl: z.string().nullable().optional(),
			}),
		)
		.optional(),
	status: messageStatusSchema.nullable(),
	latencyMs: z.number().nullable(),
	inputTokens: z.number().nullable(),
	outputTokens: z.number().nullable(),
	errorMessage: z.string().nullable(),
	toolCalls: z.string().nullable(),
	createdAt: z.string(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const chatAttachmentUploadResponseSchema = z.object({
	success: z.literal(true),
	result: z.object({
		attachmentId: z.string().uuid(),
		uploadUrl: z.string(),
		r2Key: z.string(),
	}),
});

export type ChatAttachmentUploadResponse = z.infer<
	typeof chatAttachmentUploadResponseSchema
>;

/**
 * Chat with messages response.
 */
export const chatWithMessagesResponseSchema = chatResponseSchema.extend({
	messages: z.array(messageResponseSchema),
});

export type ChatWithMessagesResponse = z.infer<
	typeof chatWithMessagesResponseSchema
>;

/**
 * Sync result response.
 */
export const syncResultResponseSchema = z.object({
	synced: z.number().int(),
	chatId: z.string().uuid(),
});

export type SyncResultResponse = z.infer<typeof syncResultResponseSchema>;
