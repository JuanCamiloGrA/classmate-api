import { STORAGE_TIER_LIMITS } from "../../domain/entities/library";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
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
 * Validates storage quota and creates pending file record.
 */
export class GenerateUploadUrlUseCase {
	constructor(
		private readonly libraryRepository: LibraryRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: GenerateUploadUrlOptions,
	) {}

	async execute(input: GenerateUploadUrlInput): Promise<PresignedUploadDTO> {
		// 1. Check storage quota
		const usage = await this.libraryRepository.getStorageUsage(input.userId);

		if (!usage) {
			throw new Error("User profile not found");
		}

		const limit = STORAGE_TIER_LIMITS[usage.tier];
		const projectedUsage = usage.usedBytes + input.sizeBytes;

		if (projectedUsage > limit) {
			throw new StorageQuotaExceededError(
				`Upload would exceed storage quota. Used: ${usage.usedBytes}, Limit: ${limit}, File size: ${input.sizeBytes}`,
			);
		}

		// 2. Generate unique file ID and R2 key
		const fileId = crypto.randomUUID();
		const sanitizedFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
		const timestamp = Date.now();
		const r2Key = `users/${input.userId}/${timestamp}-${fileId}-${sanitizedFilename}`;

		// 3. Create pending file record
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

		// 4. Generate presigned PUT URL
		const uploadUrl = await this.storageRepository.generatePresignedPutUrl(
			this.options.bucket,
			r2Key,
			input.mimeType,
			this.options.expiresInSeconds,
		);

		return {
			uploadUrl,
			fileId,
			r2Key,
		};
	}
}
