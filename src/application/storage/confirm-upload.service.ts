import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type {
	BucketType,
	StorageAccountingRepository,
} from "../../domain/repositories/storage-accounting.repository";

export interface ConfirmUploadInput {
	r2Key: string;
	bucket: string;
	bucketType: BucketType;
	userId: string;
}

export interface ConfirmUploadResult {
	confirmed: boolean;
	deltaBytes: number;
	actualSizeBytes: number;
}

/**
 * Central service for confirming file uploads and updating storage usage.
 * Idempotent - confirming the same upload multiple times is safe.
 */
export class ConfirmUploadService {
	constructor(
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly libraryRepository: LibraryRepository,
		private readonly storageRepository: StorageRepository,
	) {}

	/**
	 * Confirm an upload by:
	 * 1. Getting actual size from R2 (HEAD)
	 * 2. Marking storage object as confirmed (calculates delta)
	 * 3. Updating user's storageUsedBytes with delta
	 *
	 * This is idempotent - if already confirmed, returns 0 delta.
	 */
	async confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
		// Temporal bucket uploads don't count toward quota
		if (input.bucketType === "temporal") {
			return {
				confirmed: true,
				deltaBytes: 0,
				actualSizeBytes: 0,
			};
		}

		// Get actual size from R2
		const objectMeta = await this.storageRepository.headObject(
			input.bucket,
			input.r2Key,
		);

		if (!objectMeta) {
			throw new Error(`Object not found in R2: ${input.bucket}/${input.r2Key}`);
		}

		// Confirm in accounting (idempotent)
		const { deltaBytes } = await this.storageAccountingRepository.confirmUpload(
			{
				r2Key: input.r2Key,
				actualSizeBytes: objectMeta.sizeBytes,
			},
		);

		// Update user's storage usage if there's a delta
		if (deltaBytes !== 0) {
			await this.libraryRepository.updateStorageUsage(input.userId, deltaBytes);
		}

		return {
			confirmed: true,
			deltaBytes,
			actualSizeBytes: objectMeta.sizeBytes,
		};
	}
}
