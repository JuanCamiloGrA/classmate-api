import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import {
	buildUserR2Key,
	sanitizeFilename,
} from "../../domain/services/r2-path.service";
import { UploadGuardService } from "../storage/upload-guard.service";

export interface GenerateScribeStyleUploadUrlInput {
	userId: string;
	slot: 1 | 2;
	fileName: string;
	contentType: string;
	sizeBytes: number;
}

export interface GenerateScribeStyleUploadUrlOptions {
	bucket: string;
	expiresInSeconds: number;
}

export interface GenerateScribeStyleUploadUrlResult {
	signedUrl: string;
	file_route: string;
}

/**
 * Generates a presigned PUT URL for one of the 2 persistent Scribe style slots.
 *
 * The returned `file_route` is the stable R2 key that the client must store and
 * later send to Scribe as style reference.
 */
export class GenerateScribeStyleUploadUrlUseCase {
	private readonly uploadGuardService: UploadGuardService;

	constructor(
		private readonly profileRepository: ProfileRepository,
		private readonly libraryRepository: LibraryRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: GenerateScribeStyleUploadUrlOptions,
	) {
		this.uploadGuardService = new UploadGuardService(
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
		);
	}

	async execute(
		input: GenerateScribeStyleUploadUrlInput,
	): Promise<GenerateScribeStyleUploadUrlResult> {
		const profile = await this.profileRepository.findById(input.userId);
		if (!profile) throw new Error("Profile not found");

		const existingKey =
			input.slot === 1
				? profile.scribeStyleSlot1R2Key
				: profile.scribeStyleSlot2R2Key;

		// Overwritable: if a slot already exists, keep using the same key.
		const key =
			existingKey ??
			buildUserR2Key({
				userId: input.userId,
				category: "rubrics",
				filename: sanitizeFilename(
					`scribe-style-slot-${input.slot}-${input.fileName}`,
				),
			});

		const { uploadUrl } = await this.uploadGuardService.generatePresignedUpload(
			{
				userId: input.userId,
				r2Key: key,
				mimeType: input.contentType,
				sizeBytes: input.sizeBytes,
				bucketType: "persistent",
				bucket: this.options.bucket,
				expiresInSeconds: this.options.expiresInSeconds,
			},
		);

		return { signedUrl: uploadUrl, file_route: key };
	}
}
