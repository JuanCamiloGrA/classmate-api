import type { ClassRepository } from "../../domain/repositories/class.repository";
import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import {
	buildUserR2Key,
	sanitizeFilename,
} from "../../domain/services/r2-path.service";
import { UploadGuardService } from "../storage/upload-guard.service";

export interface GenerateClassAudioUploadUrlInput {
	userId: string;
	classId: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
}

export interface GenerateClassAudioUploadUrlResult {
	signedUrl: string;
	key: string;
}

export class ClassNotAccessibleError extends Error {
	constructor() {
		super("Class not found or you do not have access to it");
		this.name = "ClassNotAccessibleError";
	}
}

export class GenerateClassAudioUploadUrlUseCase {
	private readonly uploadGuardService: UploadGuardService;

	constructor(
		private readonly classRepository: ClassRepository,
		readonly libraryRepository: LibraryRepository,
		readonly storageAccountingRepository: StorageAccountingRepository,
		readonly storageRepository: StorageRepository,
		private readonly options: {
			bucket: string;
			expiresInSeconds: number;
		},
	) {
		this.uploadGuardService = new UploadGuardService(
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
		);
	}

	async execute(
		input: GenerateClassAudioUploadUrlInput,
	): Promise<GenerateClassAudioUploadUrlResult> {
		const { userId, classId, fileName, contentType, sizeBytes } = input;

		const classEntity = await this.classRepository.findByIdAndUserId(
			userId,
			classId,
		);

		if (!classEntity || classEntity.isDeleted === 1) {
			throw new ClassNotAccessibleError();
		}

		const sanitizedFileName = this.sanitizeFileName(fileName);
		const key = this.buildObjectKey({
			userId,
			classId,
			fileName: sanitizedFileName,
		});

		// Temporal bucket uploads don't count toward quota, but pass through guard for consistency
		const { uploadUrl, r2Key } =
			await this.uploadGuardService.generatePresignedUpload({
				userId,
				r2Key: key,
				bucketType: "temporal",
				bucket: this.options.bucket,
				sizeBytes,
				mimeType: contentType,
				expiresInSeconds: this.options.expiresInSeconds,
			});

		return {
			signedUrl: uploadUrl,
			key: r2Key,
		};
	}

	private sanitizeFileName(fileName: string): string {
		const trimmed = fileName.trim();
		if (!trimmed) {
			throw new Error("File name cannot be empty");
		}

		return trimmed.replace(/[/\\]/g, "_");
	}

	private buildObjectKey(params: {
		userId: string;
		classId: string;
		fileName: string;
	}): string {
		return buildUserR2Key({
			userId: params.userId,
			category: "temp",
			filename: sanitizeFilename(`class-${params.classId}-${params.fileName}`),
		});
	}
}
