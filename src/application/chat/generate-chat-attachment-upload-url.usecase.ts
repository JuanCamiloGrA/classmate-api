import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import { buildUserR2Key } from "../../domain/services/r2-path.service";
import {
	UploadGuardService,
	UploadPolicyViolationError,
} from "../storage/upload-guard.service";

export interface GenerateChatAttachmentUploadInput {
	userId: string;
	chatId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
}

export interface GenerateChatAttachmentUploadOptions {
	bucket: string;
	expiresInSeconds: number;
}

export interface GenerateChatAttachmentUploadResult {
	attachmentId: string;
	r2Key: string;
	uploadUrl: string;
}

export class ChatAttachmentQuotaExceededError extends Error {
	constructor(message = "Storage quota exceeded") {
		super(message);
		this.name = "ChatAttachmentQuotaExceededError";
	}
}

export class GenerateChatAttachmentUploadUrlUseCase {
	private readonly uploadGuardService: UploadGuardService;

	constructor(
		private readonly libraryRepository: LibraryRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: GenerateChatAttachmentUploadOptions,
	) {
		this.uploadGuardService = new UploadGuardService(
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
		);
	}

	async execute(
		input: GenerateChatAttachmentUploadInput,
	): Promise<GenerateChatAttachmentUploadResult> {
		const attachmentId = crypto.randomUUID();
		const r2Key = buildUserR2Key({
			userId: input.userId,
			category: "chat_attachments",
			uuid: attachmentId,
			filename: input.filename,
		});

		try {
			const { uploadUrl } =
				await this.uploadGuardService.generatePresignedUpload({
					userId: input.userId,
					r2Key,
					mimeType: input.mimeType,
					sizeBytes: input.sizeBytes,
					bucketType: "persistent",
					bucket: this.options.bucket,
					expiresInSeconds: this.options.expiresInSeconds,
				});

			return {
				attachmentId,
				r2Key,
				uploadUrl,
			};
		} catch (error) {
			if (error instanceof UploadPolicyViolationError) {
				throw new ChatAttachmentQuotaExceededError(error.message);
			}
			throw error;
		}
	}
}
