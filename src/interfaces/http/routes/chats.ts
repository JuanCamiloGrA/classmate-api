/**
 * Chat Routes
 * Public endpoints for chat provisioning and history.
 */

import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import {
	ChatQuotaExceededError,
	CreateChatUseCase,
} from "../../../application/chat/create-chat.usecase";
import { GetChatUseCase } from "../../../application/chat/get-chat.usecase";
import { GetChatMessagesUseCase } from "../../../application/chat/get-chat-messages.usecase";
import { HardDeleteChatUseCase } from "../../../application/chat/hard-delete-chat.usecase";
import { ListChatsUseCase } from "../../../application/chat/list-chats.usecase";
import { SoftDeleteChatUseCase } from "../../../application/chat/soft-delete-chat.usecase";
import { UpdateChatUseCase } from "../../../application/chat/update-chat.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ChatRepository } from "../../../infrastructure/database/repositories/chat.repository";
import { D1ChatAttachmentRepository } from "../../../infrastructure/database/repositories/chat-attachment.repository";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";
import { D1StorageAccountingRepository } from "../../../infrastructure/database/repositories/storage-accounting.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import { R2StorageService } from "../../../infrastructure/storage/r2.storage.service";
import {
	ChatIdParamSchema,
	CreateChatSchema,
	GetMessagesQuerySchema,
	ListChatsQuerySchema,
	UpdateChatSchema,
} from "../validators/chat.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ChatContext = Context<HonoContext>;

// ============================================
// RESPONSE SCHEMAS
// ============================================

const ChatSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	last_message_at: z.string().nullable(),
	message_count: z.number(),
	is_pinned: z.boolean(),
	is_archived: z.boolean(),
	context_type: z.enum(["global", "subject", "task", "pdf"]).nullable(),
	context_id: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

const ChatListItemSchema = z.object({
	id: z.string(),
	title: z.string().nullable(),
	last_message_at: z.string().nullable(),
	message_count: z.number(),
	is_pinned: z.boolean(),
	is_archived: z.boolean(),
	context_type: z.enum(["global", "subject", "task", "pdf"]).nullable(),
	context_id: z.string().nullable(),
	created_at: z.string(),
});

const MessageSchema = z.object({
	id: z.string(),
	role: z.enum(["user", "assistant", "system", "tool"]),
	sequence: z.number(),
	content: z.string(),
	attachments: z
		.array(
			z.object({
				id: z.string(),
				r2Key: z.string(),
				thumbnailR2Key: z.string().nullable(),
				originalFilename: z.string(),
				mimeType: z.string(),
				sizeBytes: z.number(),
				url: z.string().nullable(),
				thumbnailUrl: z.string().nullable(),
				expiresAt: z.string().nullable(),
			}),
		)
		.optional(),
	created_at: z.string(),
});

const ErrorResponseSchema = z.object({
	error: z.string(),
	code: z.string().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function ensureAuthenticatedUser(c: ChatContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new Error("UNAUTHORIZED");
	}
	return auth.userId;
}

function getRepositories(c: ChatContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return {
		chatRepository: new D1ChatRepository(db),
		profileRepository: new D1ProfileRepository(db),
	};
}

async function getPersistentStorageAdapter(c: ChatContext) {
	const endpoint = await resolveSecretBinding(
		c.env.R2_S3_PERSISTENT_API_ENDPOINT,
		"R2_S3_PERSISTENT_API_ENDPOINT",
	);
	const accessKeyId = await resolveSecretBinding(
		c.env.R2_PERSISTENT_ACCESS_KEY_ID,
		"R2_PERSISTENT_ACCESS_KEY_ID",
	);
	const secretAccessKey = await resolveSecretBinding(
		c.env.R2_PERSISTENT_SECRET_ACCESS_KEY,
		"R2_PERSISTENT_SECRET_ACCESS_KEY",
	);

	return new R2StorageAdapter({ endpoint, accessKeyId, secretAccessKey });
}

async function getPersistentBucketName(c: ChatContext): Promise<string> {
	return resolveSecretBinding(
		c.env.R2_PERSISTENT_BUCKET_NAME,
		"R2_PERSISTENT_BUCKET_NAME",
	);
}

async function getPersistentStorageService(c: ChatContext) {
	const endpoint = await resolveSecretBinding(
		c.env.R2_S3_PERSISTENT_API_ENDPOINT,
		"R2_S3_PERSISTENT_API_ENDPOINT",
	);
	const accessKeyId = await resolveSecretBinding(
		c.env.R2_PERSISTENT_ACCESS_KEY_ID,
		"R2_PERSISTENT_ACCESS_KEY_ID",
	);
	const secretAccessKey = await resolveSecretBinding(
		c.env.R2_PERSISTENT_SECRET_ACCESS_KEY,
		"R2_PERSISTENT_SECRET_ACCESS_KEY",
	);
	const bucketName = await getPersistentBucketName(c);

	return new R2StorageService({
		endpoint,
		accessKeyId,
		secretAccessKey,
		bucketName,
	});
}

// ============================================
// CREATE CHAT ENDPOINT
// ============================================

/**
 * POST /chats
 * Create a new chat conversation.
 */
export class CreateChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Create a new chat",
		description:
			"Provisions a new chat conversation. Returns the chat ID to use with /agents/*. Subject to tier-based quotas.",
		request: {
			body: {
				content: {
					"application/json": {
						schema: CreateChatSchema,
					},
				},
			},
		},
		responses: {
			"201": {
				description: "Chat created successfully",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: ChatSchema,
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"403": {
				description: "Chat quota exceeded",
				...contentJson(
					z.object({
						error: z.string(),
						code: z.literal("CHAT_QUOTA_EXCEEDED"),
						current_count: z.number(),
						max_allowed: z.number(),
						tier: z.string(),
					}),
				),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const body = await c.req.json();
			const validated = CreateChatSchema.parse(body);

			const { chatRepository, profileRepository } = getRepositories(c);
			const useCase = new CreateChatUseCase(chatRepository, profileRepository);

			const { chat } = await useCase.execute({
				userId,
				title: validated.title,
				contextType: validated.context_type,
				contextId: validated.context_id,
			});

			return c.json(
				{
					success: true,
					result: {
						id: chat.id,
						title: chat.title,
						last_message_at: chat.lastMessageAt,
						message_count: chat.messageCount,
						is_pinned: chat.isPinned,
						is_archived: chat.isArchived,
						context_type: chat.contextType,
						context_id: chat.contextId,
						created_at: chat.createdAt,
						updated_at: chat.updatedAt,
					},
				},
				201,
			);
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof ChatQuotaExceededError) {
				return c.json(
					{
						error: error.message,
						code: error.code,
						current_count: error.currentCount,
						max_allowed: error.maxAllowed,
						tier: error.tier,
					},
					403,
				);
			}
			console.error("Error creating chat:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// LIST CHATS ENDPOINT
// ============================================

/**
 * GET /chats
 * List user's chat conversations.
 */
export class ListChatsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "List chats",
		description: "Retrieve paginated list of user's chat conversations.",
		request: {
			query: ListChatsQuerySchema,
		},
		responses: {
			"200": {
				description: "List of chats",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.object({
							data: z.array(ChatListItemSchema),
							meta: z.object({
								total: z.number(),
								limit: z.number(),
								offset: z.number(),
							}),
						}),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const query = ListChatsQuerySchema.parse(c.req.query());

			const { chatRepository } = getRepositories(c);
			const useCase = new ListChatsUseCase(chatRepository);

			const result = await useCase.execute({
				userId,
				filters: {
					limit: query.limit,
					offset: query.offset,
					isArchived: query.is_archived,
					isPinned: query.is_pinned,
					contextType: query.context_type,
					contextId: query.context_id,
					search: query.search,
					sortOrder: query.sort_order,
				},
			});

			return c.json({
				success: true,
				result: {
					data: result.data.map((chat) => ({
						id: chat.id,
						title: chat.title,
						last_message_at: chat.lastMessageAt,
						message_count: chat.messageCount,
						is_pinned: chat.isPinned,
						is_archived: chat.isArchived,
						context_type: chat.contextType,
						context_id: chat.contextId,
						created_at: chat.createdAt,
					})),
					meta: {
						total: result.total,
						limit: result.limit,
						offset: result.offset,
					},
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			console.error("Error listing chats:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// GET CHAT ENDPOINT
// ============================================

/**
 * GET /chats/:id
 * Get a single chat by ID.
 */
export class GetChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Get chat by ID",
		description: "Retrieve a single chat conversation by its ID.",
		request: {
			params: ChatIdParamSchema,
		},
		responses: {
			"200": {
				description: "Chat found",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: ChatSchema,
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const { id: chatId } = ChatIdParamSchema.parse(c.req.param());

			const { chatRepository } = getRepositories(c);
			const useCase = new GetChatUseCase(chatRepository);

			const result = await useCase.execute({
				userId,
				chatId,
				includeMessages: false,
			});

			if (!result) {
				return c.json({ error: "Chat not found" }, 404);
			}

			const chat = result.chat;
			return c.json({
				success: true,
				result: {
					id: chat.id,
					title: chat.title,
					last_message_at: chat.lastMessageAt,
					message_count: chat.messageCount,
					is_pinned: chat.isPinned,
					is_archived: chat.isArchived,
					context_type: chat.contextType,
					context_id: chat.contextId,
					created_at: chat.createdAt,
					updated_at: chat.updatedAt,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid chat ID format" }, 400);
			}
			console.error("Error getting chat:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// GET CHAT MESSAGES ENDPOINT
// ============================================

/**
 * GET /chats/:id/messages
 * Get messages for a chat.
 */
export class GetChatMessagesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Get chat messages",
		description:
			"Retrieve messages for a chat conversation with pagination support.",
		request: {
			params: ChatIdParamSchema,
			query: GetMessagesQuerySchema,
		},
		responses: {
			"200": {
				description: "Messages retrieved",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.object({
							messages: z.array(MessageSchema),
							has_more: z.boolean(),
						}),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const { id: chatId } = ChatIdParamSchema.parse(c.req.param());
			const query = GetMessagesQuerySchema.parse(c.req.query());

			const { chatRepository } = getRepositories(c);
			const storageAdapter = await getPersistentStorageAdapter(c);
			const bucket = await getPersistentBucketName(c);
			const urlExpires = 3600;

			const useCase = new GetChatMessagesUseCase(
				chatRepository,
				storageAdapter,
			);
			const { messages, hasMore } = await useCase.execute({
				userId,
				chatId,
				limit: query.limit,
				afterSequence: query.after_sequence,
				attachmentUrlExpiresInSeconds: urlExpires,
				bucket,
			});

			return c.json({
				success: true,
				result: {
					messages: messages.map((msg) => ({
						id: msg.id,
						role: msg.role,
						sequence: msg.sequence,
						content: msg.content,
						attachments: msg.attachments,
						created_at: msg.createdAt,
					})),
					has_more: hasMore,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid request parameters" }, 400);
			}
			console.error("Error getting messages:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// UPDATE CHAT ENDPOINT
// ============================================

/**
 * PUT /chats/:id
 * Update a chat's metadata.
 */
export class UpdateChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Update chat",
		description: "Update a chat's title, pinned status, or archived status.",
		request: {
			params: ChatIdParamSchema,
			body: {
				content: {
					"application/json": {
						schema: UpdateChatSchema,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Chat updated",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: ChatSchema,
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const { id: chatId } = ChatIdParamSchema.parse(c.req.param());
			const body = await c.req.json();
			const validated = UpdateChatSchema.parse(body);

			const { chatRepository } = getRepositories(c);
			const useCase = new UpdateChatUseCase(chatRepository);

			const { chat } = await useCase.execute({
				userId,
				chatId,
				data: {
					title: validated.title,
					isPinned: validated.is_pinned,
					isArchived: validated.is_archived,
				},
			});

			return c.json({
				success: true,
				result: {
					id: chat.id,
					title: chat.title,
					last_message_at: chat.lastMessageAt,
					message_count: chat.messageCount,
					is_pinned: chat.isPinned,
					is_archived: chat.isArchived,
					context_type: chat.contextType,
					context_id: chat.contextId,
					created_at: chat.createdAt,
					updated_at: chat.updatedAt,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid request" }, 400);
			}
			if (error instanceof Error && error.message.includes("not found")) {
				return c.json({ error: "Chat not found" }, 404);
			}
			console.error("Error updating chat:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// DELETE CHAT ENDPOINT
// ============================================

/**
 * DELETE /chats/:id
 * Soft delete a chat.
 */
export class DeleteChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Delete chat",
		description: "Soft delete a chat conversation.",
		request: {
			params: ChatIdParamSchema,
		},
		responses: {
			"200": {
				description: "Chat deleted",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.object({
							id: z.string(),
							deleted_at: z.string(),
						}),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const { id: chatId } = ChatIdParamSchema.parse(c.req.param());

			const { chatRepository } = getRepositories(c);
			const useCase = new SoftDeleteChatUseCase(chatRepository);

			const { chat } = await useCase.execute({ userId, chatId });

			return c.json({
				success: true,
				result: {
					id: chat.id,
					deleted_at: chat.deletedAt,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid chat ID format" }, 400);
			}
			if (error instanceof Error && error.message.includes("not found")) {
				return c.json({ error: "Chat not found" }, 404);
			}
			console.error("Error deleting chat:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// HARD DELETE CHAT ENDPOINT
// ============================================

export class HardDeleteChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Hard delete chat",
		description:
			"Permanently delete a chat, its messages, attachments, and R2 objects.",
		request: {
			params: ChatIdParamSchema,
		},
		responses: {
			"200": {
				description: "Chat deleted",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.object({
							id: z.string(),
						}),
					}),
				),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ChatContext) {
		try {
			const userId = ensureAuthenticatedUser(c);
			const { id: chatId } = ChatIdParamSchema.parse(c.req.param());

			const db = DatabaseFactory.create(c.env.DB);
			const chatRepository = new D1ChatRepository(db);
			const chatAttachmentRepository = new D1ChatAttachmentRepository(db);
			const storageAccountingRepository = new D1StorageAccountingRepository(db);
			const libraryRepository = new D1LibraryRepository(db);
			const storageService = await getPersistentStorageService(c);

			const useCase = new HardDeleteChatUseCase(
				chatRepository,
				chatAttachmentRepository,
				storageAccountingRepository,
				libraryRepository,
				storageService,
			);

			const deleted = await useCase.execute({ userId, chatId });
			if (!deleted) {
				return c.json({ error: "Chat not found" }, 404);
			}

			return c.json({
				success: true,
				result: {
					id: chatId,
				},
			});
		} catch (error) {
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				return c.json({ error: "Unauthorized" }, 401);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid chat ID format" }, 400);
			}
			console.error("Error hard deleting chat:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
