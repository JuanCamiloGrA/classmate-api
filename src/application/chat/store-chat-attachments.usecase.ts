import type { MessageAttachmentCreateData } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { ChatAttachmentRepository } from "../../domain/repositories/chat-attachment.repository";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import { ConfirmUploadService } from "../storage/confirm-upload.service";

export interface StoreChatAttachmentsInput {
	userId: string;
	chatId: string;
	messageId: string;
	attachments: Array<{
		r2Key: string;
		thumbnailR2Key?: string | null;
		originalFilename: string;
		mimeType: string;
		sizeBytes: number;
	}>;
	bucket: string;
}

export class StoreChatAttachmentsUseCase {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly chatAttachmentRepository: ChatAttachmentRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly libraryRepository: LibraryRepository,
		private readonly storageRepository: StorageRepository,
	) {}

	async execute(input: StoreChatAttachmentsInput) {
		if (input.attachments.length === 0) return [];

		const exists = await this.chatRepository.exists(input.userId, input.chatId);
		if (!exists) {
			throw new Error("Chat not found");
		}

		const confirmService = new ConfirmUploadService(
			this.storageAccountingRepository,
			this.libraryRepository,
			this.storageRepository,
		);

		const records: MessageAttachmentCreateData[] = input.attachments.map(
			(attachment) => ({
				messageId: input.messageId,
				chatId: input.chatId,
				userId: input.userId,
				r2Key: attachment.r2Key,
				thumbnailR2Key: attachment.thumbnailR2Key ?? null,
				originalFilename: attachment.originalFilename,
				mimeType: attachment.mimeType,
				sizeBytes: attachment.sizeBytes,
			}),
		);

		for (const attachment of records) {
			await confirmService.confirmUpload({
				r2Key: attachment.r2Key,
				bucket: input.bucket,
				bucketType: "persistent",
				userId: input.userId,
			});
		}

		return this.chatAttachmentRepository.createMany(records);
	}
}
