import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import { ConfirmUploadService } from "../storage/confirm-upload.service";

export interface GenerateChatAttachmentThumbnailInput {
	userId: string;
	chatId: string;
	messageId: string;
	attachmentId: string;
	r2Key: string;
	thumbnailR2Key: string;
	bucket: string;
}

export class GenerateChatAttachmentThumbnailUseCase {
	constructor(
		private readonly storageRepository: StorageRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly libraryRepository: LibraryRepository,
	) {}

	async execute(input: GenerateChatAttachmentThumbnailInput): Promise<void> {
		const confirmService = new ConfirmUploadService(
			this.storageAccountingRepository,
			this.libraryRepository,
			this.storageRepository,
		);

		await confirmService.confirmUpload({
			r2Key: input.thumbnailR2Key,
			bucket: input.bucket,
			bucketType: "persistent",
			userId: input.userId,
		});
	}
}
