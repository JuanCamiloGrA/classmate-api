import { STORAGE_TIER_LIMITS } from "../../domain/entities/library";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type {
	BucketType,
	StorageAccountingRepository,
} from "../../domain/repositories/storage-accounting.repository";

export interface UploadPolicyInput {
	userId: string;
	sizeBytes: number;
	bucketType: BucketType;
}

export interface UploadPolicyResult {
	allowed: boolean;
	reason?: string;
}

export interface GeneratePresignedUploadInput {
	userId: string;
	r2Key: string;
	mimeType: string;
	sizeBytes: number;
	bucketType: BucketType;
	bucket: string;
	expiresInSeconds: number;
}

export interface GeneratePresignedUploadResult {
	uploadUrl: string;
	r2Key: string;
}

/**
 * Central service for upload policy enforcement and presigned URL generation.
 * Single source of truth for all upload operations.
 */
export class UploadGuardService {
	constructor(
		private readonly libraryRepository: LibraryRepository,
		private readonly storageAccountingRepository: StorageAccountingRepository,
		private readonly storageRepository: StorageRepository,
	) {}

	/**
	 * Check if user is allowed to upload a file.
	 * Currently always returns allowed=true (stub for future quota enforcement).
	 */
	async checkUploadPolicy(
		input: UploadPolicyInput,
	): Promise<UploadPolicyResult> {
		// For temporal bucket, always allow (no quota)
		if (input.bucketType === "temporal") {
			return { allowed: true };
		}

		// For persistent bucket, check quota
		const usage = await this.libraryRepository.getStorageUsage(input.userId);

		if (!usage) {
			return {
				allowed: false,
				reason: "User profile not found",
			};
		}

		const limit = STORAGE_TIER_LIMITS[usage.tier];
		const projectedUsage = usage.usedBytes + input.sizeBytes;

		if (projectedUsage > limit) {
			return {
				allowed: false,
				reason: `Upload would exceed storage quota. Used: ${usage.usedBytes}, Limit: ${limit}, File size: ${input.sizeBytes}`,
			};
		}

		// TODO: Add more policy checks here (file type, rate limiting, etc.)
		return { allowed: true };
	}

	/**
	 * Generate presigned upload URL after policy check.
	 * For persistent bucket, creates pending storage object record.
	 */
	async generatePresignedUpload(
		input: GeneratePresignedUploadInput,
	): Promise<GeneratePresignedUploadResult> {
		// Check policy first
		const policyCheck = await this.checkUploadPolicy({
			userId: input.userId,
			sizeBytes: input.sizeBytes,
			bucketType: input.bucketType,
		});

		if (!policyCheck.allowed) {
			throw new UploadPolicyViolationError(
				policyCheck.reason ?? "Upload not allowed",
			);
		}

		// For persistent bucket, register pending upload
		if (input.bucketType === "persistent") {
			await this.storageAccountingRepository.createOrUpdatePending({
				userId: input.userId,
				r2Key: input.r2Key,
				bucketType: input.bucketType,
				sizeBytes: input.sizeBytes,
			});
		}

		// Generate presigned URL
		const uploadUrl = await this.storageRepository.generatePresignedPutUrl(
			input.bucket,
			input.r2Key,
			input.mimeType,
			input.expiresInSeconds,
		);

		return {
			uploadUrl,
			r2Key: input.r2Key,
		};
	}
}

export class UploadPolicyViolationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UploadPolicyViolationError";
	}
}
