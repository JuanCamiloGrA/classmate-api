import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import { buildUserR2Key } from "../../domain/services/r2-path.service";
import {
	UploadGuardService,
	UploadPolicyViolationError,
} from "../storage/upload-guard.service";
import type { PresignedUploadDTO } from "./library.dto";

export interface GenerateUploadUrlInput {
	userId: string;
	filename: string;
	mimeType: string;
	sizeBytes: number;
	subjectId?: string;
	taskId?: string;
}

export interface GenerateUploadUrlOptions {
	bucket: string;
	expiresInSeconds: number;
}

export class StorageQuotaExceededError extends Error {
	constructor(message = "Storage quota exceeded") {
		super(message);
		this.name = "StorageQuotaExceededError";
	}
}

/**
 * Use case for generating presigned upload URL.
 * Now uses UploadGuardService for centralized policy and accounting.
 */
export class GenerateUploadUrlUseCase {
	private readonly uploadGuardService: UploadGuardService;

	constructor(
		private readonly libraryRepository: LibraryRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: GenerateUploadUrlOptions,
	) {
		this.uploadGuardService = new UploadGuardService(
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
		);
	}

	async execute(input: GenerateUploadUrlInput): Promise<PresignedUploadDTO> {
		// Generate unique file ID and R2 key
		const fileId = crypto.randomUUID();
		const r2Key = buildUserR2Key({
			userId: input.userId,
			category: "user_uploads",
			uuid: fileId,
			filename: input.filename,
		});

		try {
			// Use UploadGuardService for policy check and presigned URL generation
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

			// Create pending file record for library tracking
			await this.libraryRepository.createPendingFile({
				id: fileId,
				userId: input.userId,
				r2Key,
				originalFilename: input.filename,
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				subjectId: input.subjectId ?? null,
				taskId: input.taskId ?? null,
			});

			return {
				uploadUrl,
				fileId,
				r2Key,
			};
		} catch (error) {
			if (error instanceof UploadPolicyViolationError) {
				throw new StorageQuotaExceededError(error.message);
			}
			throw error;
		}
	}
}
