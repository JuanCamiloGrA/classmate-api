import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { ChatAttachmentRepository } from "../../domain/repositories/chat-attachment.repository";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import type { StorageService } from "../../domain/services/storage.service";

export interface HardDeleteChatInput {
	userId: string;
	chatId: string;
}

export class HardDeleteChatUseCase {
	constructor(
		private readonly chatRepository: ChatRepository,
		private readonly chatAttachmentRepository: ChatAttachmentRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly libraryRepository: LibraryRepository,
		private readonly storageService: StorageService,
	) {}

	async execute(input: HardDeleteChatInput): Promise<boolean> {
		const attachments = await this.chatAttachmentRepository.listByChatId(
			input.userId,
			input.chatId,
		);

		let totalDeltaBytes = 0;
		const r2Keys = attachments
			.flatMap((attachment) => [attachment.r2Key, attachment.thumbnailR2Key])
			.filter((key): key is string => Boolean(key));

		for (const r2Key of r2Keys) {
			try {
				await this.storageService.deleteFile(r2Key);
			} catch (error) {
				console.error("Failed to delete R2 object", { r2Key, error });
			}

			try {
				const { deltaBytes } =
					await this.storageAccountingRepository.markDeleted(r2Key);
				totalDeltaBytes += deltaBytes;
			} catch (error) {
				console.error("Failed to mark storage object deleted", {
					r2Key,
					error,
				});
			}
		}

		if (totalDeltaBytes !== 0) {
			await this.libraryRepository.updateStorageUsage(
				input.userId,
				totalDeltaBytes,
			);
		}

		return this.chatRepository.hardDelete(input.userId, input.chatId);
	}
}
