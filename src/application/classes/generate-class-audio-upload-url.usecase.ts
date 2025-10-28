import type { ClassRepository } from "../../domain/repositories/class.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";

export interface GenerateClassAudioUploadUrlInput {
	userId: string;
	classId: string;
	fileName: string;
	contentType: string;
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
	constructor(
		private readonly classRepository: ClassRepository,
		private readonly storageRepository: StorageRepository,
		private readonly options: {
			bucket: string;
			expiresInSeconds: number;
		},
	) {}

	async execute(
		input: GenerateClassAudioUploadUrlInput,
	): Promise<GenerateClassAudioUploadUrlResult> {
		const { userId, classId, fileName, contentType } = input;

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

		const signedUrl = await this.storageRepository.generatePresignedPutUrl(
			this.options.bucket,
			key,
			contentType,
			this.options.expiresInSeconds,
		);

		return {
			signedUrl,
			key,
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
		const uniqueId = crypto.randomUUID();
		return `temporal/class-audio/${params.userId}/${params.classId}/${uniqueId}-${params.fileName}`;
	}
}
