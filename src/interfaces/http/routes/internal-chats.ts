/**
 * Internal Chat Routes
 * Endpoints for Durable Object → Worker communication.
 * Protected by X-Internal-Key authentication.
 */

import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { SyncMessagesUseCase } from "../../../application/chat/sync-messages.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import type { MessageRole } from "../../../domain/entities/chat";
import { SimpleChatTitleGenerator } from "../../../domain/services/chat-title.service";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ChatRepository } from "../../../infrastructure/database/repositories/chat.repository";
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

			// 4. Verify chat exists and belongs to the specified user
			const chatExists = await chatRepository.exists(
				validated.userId,
				validated.chatId,
			);
			if (!chatExists) {
				return c.json(
					{
						error: "Chat not found or not owned by user",
						code: "CHAT_NOT_FOUND",
					},
					404,
				);
			}

			// 5. Execute sync
			const titleGenerator = new SimpleChatTitleGenerator();
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

			console.error("[Internal] Sync error:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
