import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import {
	ChatAttachmentQuotaExceededError,
	GenerateChatAttachmentUploadUrlUseCase,
} from "../../../application/chat/generate-chat-attachment-upload-url.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ChatRepository } from "../../../infrastructure/database/repositories/chat.repository";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { D1StorageAccountingRepository } from "../../../infrastructure/database/repositories/storage-accounting.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	ChatAttachmentUploadSchema,
	ChatIdParamSchema,
} from "../validators/chat.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ChatContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

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

function ensureAuthenticatedUser(c: ChatContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new Error("UNAUTHORIZED");
	}
	return auth.userId;
}

export class GenerateChatAttachmentUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Chats"],
		summary: "Generate chat attachment upload URL",
		description:
			"Generate a presigned URL to upload a chat attachment directly to R2 persistent storage.",
		request: {
			params: ChatIdParamSchema,
			body: {
				content: {
					"application/json": {
						schema: ChatAttachmentUploadSchema,
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Presigned upload URL generated",
				...contentJson(
					z.object({
						success: z.literal(true),
						result: z.object({
							attachmentId: z.string(),
							uploadUrl: z.string(),
							r2Key: z.string(),
						}),
					}),
				),
			},
			"400": {
				description: "Invalid request",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Unauthorized",
				...contentJson(ErrorResponseSchema),
			},
			"402": {
				description: "Storage quota exceeded",
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
			const parsed = ChatAttachmentUploadSchema.parse(body);

			const db = DatabaseFactory.create(c.env.DB);
			const chatRepository = new D1ChatRepository(db);
			const chatExists = await chatRepository.exists(userId, chatId);
			if (!chatExists) {
				return c.json({ error: "Chat not found" }, 404);
			}

			const libraryRepository = new D1LibraryRepository(db);
			const storageAccountingRepository = new D1StorageAccountingRepository(db);
			const storageAdapter = await getPersistentStorageAdapter(c);
			const bucket = await getPersistentBucketName(c);
			const expiresInSeconds = c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS
				? Number.parseInt(c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS, 10)
				: 300;

			const useCase = new GenerateChatAttachmentUploadUrlUseCase(
				libraryRepository,
				storageAccountingRepository,
				storageAdapter,
				{ bucket, expiresInSeconds },
			);

			const result = await useCase.execute({
				userId,
				chatId,
				filename: parsed.filename,
				mimeType: parsed.mimeType,
				sizeBytes: parsed.sizeBytes,
			});

			return c.json({ success: true, result }, 200);
		} catch (error) {
			if (error instanceof ChatAttachmentQuotaExceededError) {
				return c.json({ error: error.message }, 402);
			}
			if (error instanceof z.ZodError) {
				return c.json({ error: "Invalid request" }, 400);
			}
			console.error("Error generating chat attachment upload URL:", error);
			return c.json({ error: "Internal server error" }, 500);
		}
	}
}
