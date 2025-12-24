import type { LibraryRepository } from "../../domain/repositories/library.repository";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { StorageAccountingRepository } from "../../domain/repositories/storage-accounting.repository";
import {
	buildUserR2Key,
	sanitizeFilename,
} from "../../domain/services/r2-path.service";
import { UploadGuardService } from "../storage/upload-guard.service";

export class ScribeProjectNotAccessibleError extends Error {
	constructor(message = "Scribe project not found or not accessible") {
		super(message);
		this.name = "ScribeProjectNotAccessibleError";
	}
}

export interface GenerateScribeAnswerUploadUrlInput {
	userId: string;
	projectId: string;
	questionId: string;
	fileName: string;
	contentType: string;
	sizeBytes: number;
}

export interface GenerateScribeAnswerUploadUrlOptions {
	bucket: string;
	expiresInSeconds: number;
}

export interface GenerateScribeAnswerUploadUrlResult {
	signedUrl: string;
	file_route: string;
}

/**
 * Generates a presigned PUT URL for a form answer image.
 *
 * The returned `file_route` is the R2 key that the client must store in the
 * answer payload and later send back to Scribe.
 */
export class GenerateScribeAnswerUploadUrlUseCase {
	private readonly uploadGuardService: UploadGuardService;

	constructor(
		private readonly scribeProjectRepository: ScribeProjectRepository,
		readonly libraryRepository: LibraryRepository,
		readonly storageAccountingRepository: StorageAccountingRepository,
		readonly storageRepository: StorageRepository,
		private readonly options: GenerateScribeAnswerUploadUrlOptions,
	) {
		this.uploadGuardService = new UploadGuardService(
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
		);
	}

	async execute(
		input: GenerateScribeAnswerUploadUrlInput,
	): Promise<GenerateScribeAnswerUploadUrlResult> {
		const project = await this.scribeProjectRepository.findById(
			input.userId,
			input.projectId,
		);

		if (!project) {
			throw new ScribeProjectNotAccessibleError();
		}

		const uploadId = crypto.randomUUID();
		const key = buildUserR2Key({
			userId: input.userId,
			category: "rubrics",
			uuid: uploadId,
			filename: sanitizeFilename(`${input.questionId}-${input.fileName}`),
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
