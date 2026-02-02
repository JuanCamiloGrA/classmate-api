import { and, eq, inArray } from "drizzle-orm";
import type { MessageAttachment } from "../../../domain/entities/chat";
import type {
	ChatAttachmentRepository,
	CreateMessageAttachmentInput,
} from "../../../domain/repositories/chat-attachment.repository";
import type { Database } from "../client";
import { messageAttachments } from "../schema";

export class D1ChatAttachmentRepository implements ChatAttachmentRepository {
	constructor(private db: Database) {}

	async createMany(
		inputs: CreateMessageAttachmentInput[],
	): Promise<MessageAttachment[]> {
		if (inputs.length === 0) return [];

		const now = new Date().toISOString();
		const created = await this.db
			.insert(messageAttachments)
			.values(
				inputs.map((input) => ({
					id: crypto.randomUUID(),
					messageId: input.messageId,
					chatId: input.chatId,
					userId: input.userId,
					r2Key: input.r2Key,
					thumbnailR2Key: input.thumbnailR2Key ?? null,
					originalFilename: input.originalFilename,
					mimeType: input.mimeType,
					sizeBytes: input.sizeBytes,
					createdAt: now,
				})),
			)
			.returning();

		return created.map((attachment) => ({
			id: attachment.id,
			messageId: attachment.messageId,
			chatId: attachment.chatId,
			userId: attachment.userId,
			r2Key: attachment.r2Key,
			thumbnailR2Key: attachment.thumbnailR2Key,
			originalFilename: attachment.originalFilename,
			mimeType: attachment.mimeType,
			sizeBytes: attachment.sizeBytes,
			createdAt: attachment.createdAt,
		}));
	}

	async listByChatId(userId: string, chatId: string) {
		return this.db
			.select()
			.from(messageAttachments)
			.where(
				and(
					eq(messageAttachments.userId, userId),
					eq(messageAttachments.chatId, chatId),
				),
			)
			.all()
			.then((attachments) =>
				attachments.map((attachment) => ({
					id: attachment.id,
					messageId: attachment.messageId,
					chatId: attachment.chatId,
					userId: attachment.userId,
					r2Key: attachment.r2Key,
					thumbnailR2Key: attachment.thumbnailR2Key,
					originalFilename: attachment.originalFilename,
					mimeType: attachment.mimeType,
					sizeBytes: attachment.sizeBytes,
					createdAt: attachment.createdAt,
				})),
			);
	}

	async listByMessageIds(
		userId: string,
		chatId: string,
		messageIds: string[],
	): Promise<MessageAttachment[]> {
		if (messageIds.length === 0) return [];

		const attachments = await this.db
			.select()
			.from(messageAttachments)
			.where(
				and(
					eq(messageAttachments.userId, userId),
					eq(messageAttachments.chatId, chatId),
					inArray(messageAttachments.messageId, messageIds),
				),
			)
			.all();

		return attachments.map((attachment) => ({
			id: attachment.id,
			messageId: attachment.messageId,
			chatId: attachment.chatId,
			userId: attachment.userId,
			r2Key: attachment.r2Key,
			thumbnailR2Key: attachment.thumbnailR2Key,
			originalFilename: attachment.originalFilename,
			mimeType: attachment.mimeType,
			sizeBytes: attachment.sizeBytes,
			createdAt: attachment.createdAt,
		}));
	}

	async deleteByChatId(userId: string, chatId: string): Promise<void> {
		await this.db
			.delete(messageAttachments)
			.where(
				and(
					eq(messageAttachments.userId, userId),
					eq(messageAttachments.chatId, chatId),
				),
			)
			.run();
	}
}
