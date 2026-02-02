import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import { buildChatAttachmentThumbnailKey } from "../../domain/services/r2-path.service";
import { ConfirmUploadService } from "../storage/confirm-upload.service";

export interface ProcessChatAttachmentThumbnailInput {
	userId: string;
	chatId: string;
	messageId: string;
	attachmentId: string;
	r2Key: string;
	bucket: string;
}

export class ProcessChatAttachmentThumbnailUseCase {
	constructor(
		private readonly storageRepository: StorageRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly libraryRepository: LibraryRepository,
	) {}

	async execute(input: ProcessChatAttachmentThumbnailInput): Promise<string> {
		const imageResponse = await this.storageRepository.generatePresignedGetUrl(
			input.bucket,
			input.r2Key,
			300,
		);

		const resizeResponse = await fetch(imageResponse, {
			cf: {
				image: {
					format: "webp",
					width: 512,
					height: 512,
					fit: "scale-down",
				},
			},
		});

		if (!resizeResponse.ok) {
			throw new Error("Failed to generate thumbnail");
		}

		const bytes = new Uint8Array(await resizeResponse.arrayBuffer());
		const thumbnailKey = buildChatAttachmentThumbnailKey({
			userId: input.userId,
			chatId: input.chatId,
			messageId: input.messageId,
			attachmentId: input.attachmentId,
		});

		await this.storageRepository.putObject(
			input.bucket,
			thumbnailKey,
			bytes,
			"image/webp",
		);

		const confirmService = new ConfirmUploadService(
			this.storageAccountingRepository,
			this.libraryRepository,
			this.storageRepository,
		);

		await confirmService.confirmUpload({
			r2Key: thumbnailKey,
			bucket: input.bucket,
			bucketType: "persistent",
			userId: input.userId,
		});

		return thumbnailKey;
	}
}
