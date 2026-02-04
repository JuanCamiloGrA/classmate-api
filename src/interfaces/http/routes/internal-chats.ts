/**
 * Internal Chat Routes
 * Endpoints for Durable Object → Worker communication.
 * Protected by X-Internal-Key authentication.
 */

import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { ProcessChatAttachmentThumbnailUseCase } from "../../../application/chat/process-chat-attachment-thumbnail.usecase";
import { StoreChatAttachmentsUseCase } from "../../../application/chat/store-chat-attachments.usecase";
import { SyncMessagesUseCase } from "../../../application/chat/sync-messages.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import type { MessageRole } from "../../../domain/entities/chat";
import { AIChatTitleGenerator } from "../../../infrastructure/ai/chat-title.ai.service";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ChatRepository } from "../../../infrastructure/database/repositories/chat.repository";
import { D1ChatAttachmentRepository } from "../../../infrastructure/database/repositories/chat-attachment.repository";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { D1StorageAccountingRepository } from "../../../infrastructure/database/repositories/storage-accounting.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import { UuidSchema } from "../validators/chat.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type InternalContext = Context<HonoContext>;

// ============================================
// REQUEST SCHEMAS
// ============================================

const SyncMessageSchema = z.object({
	chatId: UuidSchema,
	userId: z.string().min(1),
	role: z.enum(["user", "assistant", "system", "tool"]),
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
	status: z.enum(["streaming", "complete", "error"]).nullable().optional(),
	latencyMs: z.number().int().nullable().optional(),
	inputTokens: z.number().int().nullable().optional(),
	outputTokens: z.number().int().nullable().optional(),
	errorMessage: z.string().nullable().optional(),
	toolCalls: z.string().nullable().optional(),
});

const SyncMessagesRequestSchema = z.object({
	chatId: UuidSchema,
	userId: z.string().min(1),
	lastSyncedSequence: z.number().int().min(0),
	messages: z.array(SyncMessageSchema),
});

// ============================================
// RESPONSE SCHEMAS
// ============================================

const ErrorResponseSchema = z.object({
	error: z.string(),
	code: z.string().optional(),
});

const SyncSuccessResponseSchema = z.object({
	success: z.literal(true),
	synced: z.number(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function verifyInternalKey(c: InternalContext): Promise<boolean> {
	const providedKey = c.req.header("X-Internal-Key");
	if (!providedKey) {
		return false;
	}

	try {
		const expectedKey = await resolveSecretBinding(
			c.env.INTERNAL_API_KEY,
			"INTERNAL_API_KEY",
		);
		return providedKey === expectedKey;
	} catch {
		return false;
	}
}

// ============================================
// SYNC MESSAGES ENDPOINT
// ============================================

/**
 * POST /internal/chats/sync
 * Sync messages from Durable Object to D1.
 * Protected by X-Internal-Key authentication.
 */
export class SyncChatMessagesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Internal"],
		summary: "Sync chat messages (internal)",
		description:
			"Synchronizes messages from Durable Object to D1. Protected by X-Internal-Key header.",
		security: [{ internalKey: [] }],
		request: {
			headers: z.object({
				"X-Internal-Key": z.string(),
			}),
			body: {
				content: {
					"application/json": {
						schema: SyncMessagesRequestSchema,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Messages synced successfully",
				...contentJson(SyncSuccessResponseSchema),
			},
			"401": {
				description: "Invalid or missing internal key",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Chat not found or not owned by user",
				...contentJson(ErrorResponseSchema),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: InternalContext) {
		try {
			// 1. Verify internal key
			const isValid = await verifyInternalKey(c);
			if (!isValid) {
				return c.json(
					{ error: "Unauthorized", code: "INVALID_INTERNAL_KEY" },
					401,
				);
			}

			// 2. Parse and validate request body
			const body = await c.req.json();
			const validated = SyncMessagesRequestSchema.parse(body);

			// 3. Setup repositories
			const db = DatabaseFactory.create(c.env.DB);
			const chatRepository = new D1ChatRepository(db);
			const chatAttachmentRepository = new D1ChatAttachmentRepository(db);
			const libraryRepository = new D1LibraryRepository(db);
			const storageAccountingRepository = new D1StorageAccountingRepository(db);

			// 4. Auto-provision chat if it doesn't exist (self-healing)
			const chatExists = await chatRepository.exists(
				validated.userId,
				validated.chatId,
			);

			if (!chatExists) {
				try {
					await chatRepository.create({
						id: validated.chatId,
						userId: validated.userId,
						title: null, // Will be generated by AI after sync
					});
				} catch (error) {
					// Handle concurrent creation attempts safely.
					// D1/SQLite constraint violations contain "UNIQUE constraint" or "SQLITE_CONSTRAINT".
					if (
						error instanceof Error &&
						(error.message.includes("UNIQUE constraint") ||
							error.message.includes("SQLITE_CONSTRAINT"))
					) {
						// Another request created the chat first; proceed with sync.
					} else {
						throw error;
					}
				}
			}

			// 5. Execute sync with AI title generator
			const aiGatewayApiKey = await resolveSecretBinding(
				c.env.AI_GATEWAY_API_KEY,
				"AI_GATEWAY_API_KEY",
			);
			const titleGenerator = new AIChatTitleGenerator(aiGatewayApiKey);
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);

			const result = await useCase.execute({
				batch: {
					chatId: validated.chatId,
					userId: validated.userId,
					lastSyncedSequence: validated.lastSyncedSequence,
					messages: validated.messages.map((m) => ({
						chatId: m.chatId,
						userId: m.userId,
						role: m.role as MessageRole,
						sequence: m.sequence,
						content: m.content,
						status: m.status ?? null,
						latencyMs: m.latencyMs ?? null,
						inputTokens: m.inputTokens ?? null,
						outputTokens: m.outputTokens ?? null,
						errorMessage: m.errorMessage ?? null,
						toolCalls: m.toolCalls ?? null,
					})),
				},
			});

			const persistentBucket = await resolveSecretBinding(
				c.env.R2_PERSISTENT_BUCKET_NAME,
				"R2_PERSISTENT_BUCKET_NAME",
			);
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
			const storageAdapter = new R2StorageAdapter({
				endpoint,
				accessKeyId,
				secretAccessKey,
			});
			const attachmentUseCase = new StoreChatAttachmentsUseCase(
				chatRepository,
				chatAttachmentRepository,
				storageAccountingRepository,
				libraryRepository,
				storageAdapter,
			);
			const thumbnailUseCase = new ProcessChatAttachmentThumbnailUseCase(
				storageAdapter,
				storageAccountingRepository,
				libraryRepository,
			);

			const messageIdMap = await chatRepository.getMessages(
				validated.userId,
				validated.chatId,
				validated.messages.length + validated.lastSyncedSequence,
			);
			const messageBySequence = new Map(
				messageIdMap.map((message) => [message.sequence, message.id]),
			);

			const totalAttachmentBytes = validated.messages.reduce(
				(total, message) =>
					total +
					(message.attachments?.reduce(
						(innerTotal, attachment) => innerTotal + attachment.sizeBytes,
						0,
					) ?? 0),
				0,
			);

			if (totalAttachmentBytes > 40 * 1024 * 1024) {
				return c.json(
					{ error: "Attachments exceed total size limit of 40MB" },
					400,
				);
			}

			for (const message of validated.messages) {
				if (!message.attachments || message.attachments.length === 0) {
					continue;
				}
				const messageId = messageBySequence.get(message.sequence);
				if (!messageId) {
					continue;
				}

				const storedAttachments = await attachmentUseCase.execute({
					userId: validated.userId,
					chatId: validated.chatId,
					messageId,
					bucket: persistentBucket,
					attachments: message.attachments.map((attachment) => ({
						r2Key: attachment.r2Key,
						thumbnailR2Key: attachment.thumbnailR2Key ?? null,
						originalFilename: attachment.originalFilename,
						mimeType: attachment.mimeType,
						sizeBytes: attachment.sizeBytes,
					})),
				});

				for (const attachment of storedAttachments) {
					if (!attachment.mimeType.startsWith("image/")) {
						continue;
					}
					if (!attachment.thumbnailR2Key) {
						continue;
					}
					await thumbnailUseCase.execute({
						userId: validated.userId,
						chatId: validated.chatId,
						messageId,
						attachmentId: attachment.id,
						r2Key: attachment.r2Key,
						thumbnailR2Key: attachment.thumbnailR2Key,
						bucket: persistentBucket,
					});
				}
			}

			return c.json({
				success: true,
				synced: result.synced,
			});
		} catch (error) {
			if (error instanceof z.ZodError) {
				return c.json(
					{
						error: "Invalid request body",
						code: "VALIDATION_ERROR",
					},
					400,
				);
			}

			console.error("[SyncMessages] Sync error:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}

// ============================================
// CLEANUP EMPTY CHAT ENDPOINT
// ============================================

const CleanupEmptyChatRequestSchema = z.object({
	chatId: UuidSchema,
	userId: z.string().min(1),
});

const CleanupSuccessResponseSchema = z.object({
	success: z.literal(true),
	deleted: z.boolean(),
	reason: z.string(),
});

/**
 * POST /internal/chats/cleanup-empty
 * Clean up a chat that has no messages (e.g., user disconnected before sending any message).
 * Protected by X-Internal-Key authentication.
 */
export class CleanupEmptyChatEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Internal"],
		summary: "Cleanup empty chat (internal)",
		description:
			"Permanently deletes a chat if it has no messages. Called by Durable Object on connection close. Protected by X-Internal-Key header.",
		security: [{ internalKey: [] }],
		request: {
			headers: z.object({
				"X-Internal-Key": z.string(),
			}),
			body: {
				content: {
					"application/json": {
						schema: CleanupEmptyChatRequestSchema,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Cleanup result",
				...contentJson(CleanupSuccessResponseSchema),
			},
			"401": {
				description: "Invalid or missing internal key",
				...contentJson(ErrorResponseSchema),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: InternalContext) {
		try {
			// 1. Verify internal key
			const isValid = await verifyInternalKey(c);
			if (!isValid) {
				return c.json(
					{ error: "Unauthorized", code: "INVALID_INTERNAL_KEY" },
					401,
				);
			}

			// 2. Parse and validate request body
			const body = await c.req.json();
			const validated = CleanupEmptyChatRequestSchema.parse(body);

			// 3. Setup repository
			const db = DatabaseFactory.create(c.env.DB);
			const chatRepository = new D1ChatRepository(db);

			// 4. Check if chat exists and has no messages
			const chat = await chatRepository.findById(
				validated.userId,
				validated.chatId,
			);

			if (!chat) {
				return c.json({
					success: true,
					deleted: false,
					reason: "Chat not found or already deleted",
				});
			}

			// Only delete if chat has no messages
			if (chat.messageCount > 0) {
				return c.json({
					success: true,
					deleted: false,
					reason: `Chat has ${chat.messageCount} messages, not deleting`,
				});
			}

			// 5. Hard delete the empty chat
			const deleted = await chatRepository.hardDelete(
				validated.userId,
				validated.chatId,
			);

			console.log(
				`[CleanupEmptyChat] Chat ${validated.chatId} deleted: ${deleted}`,
			);

			return c.json({
				success: true,
				deleted,
				reason: deleted
					? "Empty chat deleted successfully"
					: "Failed to delete chat",
			});
		} catch (error) {
			if (error instanceof z.ZodError) {
				return c.json(
					{
						error: "Invalid request body",
						code: "VALIDATION_ERROR",
					},
					400,
				);
			}

			console.error("[CleanupEmptyChat] Cleanup error:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
