import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import {
	buildUserR2Key,
	sanitizeFilename,
} from "../../domain/services/r2-path.service";

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
	constructor(
		private readonly scribeProjectRepository: ScribeProjectRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: GenerateScribeAnswerUploadUrlOptions,
	) {}

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

		const signedUrl = await this.storageRepository.generatePresignedPutUrl(
			this.options.bucket,
			key,
			input.contentType,
			this.options.expiresInSeconds,
		);

		return { signedUrl, file_route: key };
	}
}
