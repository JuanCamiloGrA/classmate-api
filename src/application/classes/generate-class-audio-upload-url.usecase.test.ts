import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassWithResources } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import {
	ClassNotAccessibleError,
	GenerateClassAudioUploadUrlUseCase,
} from "./generate-class-audio-upload-url.usecase";

const mockClass: ClassWithResources = {
	id: "class-123",
	userId: "user-123",
	subjectId: "subject-123",
	title: "Test Class",
	startDate: null,
	endDate: null,
	link: null,
	meetingLink: null,
	status: "scheduled",
	aiStatus: "none",
	topics: null,
	durationSeconds: 0,
	content: null,
	summary: null,
	transcriptionText: null,
	roomLocation: null,
	isProcessed: 0,
	isDeleted: 0,
	deletedAt: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
	resources: [],
};

const mockDeletedClass: ClassWithResources = {
	...mockClass,
	isDeleted: 1,
	deletedAt: "2024-10-16T11:00:00.000Z",
};

describe("GenerateClassAudioUploadUrlUseCase", () => {
	let mockClassRepository: ClassRepository;
	let mockStorageRepository: StorageRepository;

	beforeEach(() => {
		mockClassRepository = {
			findAll: vi.fn(),
			findByIdAndUserId: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			softDelete: vi.fn(),
			hardDelete: vi.fn(),
		};

		mockStorageRepository = {
			generatePresignedPutUrl: vi.fn(),
			generatePresignedGetUrl: vi.fn(),
		};
	});

	it("should generate presigned URL for valid class", async () => {
		const mockSignedUrl =
			"https://bucket.r2.cloudflarestorage.com/temporal/class-audio/user-123/class-123/uuid-audio.mp3?signature=xyz";

		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockClass);
		(
			mockStorageRepository.generatePresignedPutUrl as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockSignedUrl);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		const result = await useCase.execute({
			userId: "user-123",
			classId: "class-123",
			fileName: "audio.mp3",
			contentType: "audio/mpeg",
		});

		expect(result.signedUrl).toBe(mockSignedUrl);
		expect(result.key).toMatch(
			/^temporal\/class-audio\/user-123\/class-123\/[a-f0-9-]+-audio\.mp3$/,
		);
		expect(mockClassRepository.findByIdAndUserId).toHaveBeenCalledWith(
			"user-123",
			"class-123",
		);
		expect(mockStorageRepository.generatePresignedPutUrl).toHaveBeenCalledWith(
			"temporal",
			expect.stringContaining("temporal/class-audio/user-123/class-123/"),
			"audio/mpeg",
			300,
		);
	});

	it("should throw ClassNotAccessibleError if class not found", async () => {
		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(null);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		await expect(
			useCase.execute({
				userId: "user-123",
				classId: "non-existent",
				fileName: "audio.mp3",
				contentType: "audio/mpeg",
			}),
		).rejects.toThrow(ClassNotAccessibleError);
	});

	it("should throw ClassNotAccessibleError if class is soft-deleted", async () => {
		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockDeletedClass);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		await expect(
			useCase.execute({
				userId: "user-123",
				classId: "class-123",
				fileName: "audio.mp3",
				contentType: "audio/mpeg",
			}),
		).rejects.toThrow(ClassNotAccessibleError);
	});

	it("should sanitize file names with slashes", async () => {
		const mockSignedUrl = "https://example.com/presigned";

		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockClass);
		(
			mockStorageRepository.generatePresignedPutUrl as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockSignedUrl);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		const result = await useCase.execute({
			userId: "user-123",
			classId: "class-123",
			fileName: "path/to/audio.mp3",
			contentType: "audio/mpeg",
		});

		expect(result.key).toMatch(/path_to_audio\.mp3$/);
		expect(result.key).not.toContain("/audio.mp3");
	});

	it("should throw error for empty file name", async () => {
		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockClass);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		await expect(
			useCase.execute({
				userId: "user-123",
				classId: "class-123",
				fileName: "   ",
				contentType: "audio/mpeg",
			}),
		).rejects.toThrow("File name cannot be empty");
	});

	it("should use custom expiration time", async () => {
		const mockSignedUrl = "https://example.com/presigned";

		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockClass);
		(
			mockStorageRepository.generatePresignedPutUrl as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockSignedUrl);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 600,
			},
		);

		await useCase.execute({
			userId: "user-123",
			classId: "class-123",
			fileName: "audio.mp3",
			contentType: "audio/wav",
		});

		expect(mockStorageRepository.generatePresignedPutUrl).toHaveBeenCalledWith(
			"temporal",
			expect.any(String),
			"audio/wav",
			600,
		);
	});

	it("should generate unique keys for multiple uploads", async () => {
		const mockSignedUrl = "https://example.com/presigned";

		(
			mockClassRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockClass);
		(
			mockStorageRepository.generatePresignedPutUrl as ReturnType<typeof vi.fn>
		).mockResolvedValue(mockSignedUrl);

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			mockClassRepository,
			mockStorageRepository,
			{
				bucket: "temporal",
				expiresInSeconds: 300,
			},
		);

		const result1 = await useCase.execute({
			userId: "user-123",
			classId: "class-123",
			fileName: "audio.mp3",
			contentType: "audio/mpeg",
		});

		const result2 = await useCase.execute({
			userId: "user-123",
			classId: "class-123",
			fileName: "audio.mp3",
			contentType: "audio/mpeg",
		});

		expect(result1.key).not.toBe(result2.key);
		expect(result1.key).toMatch(/[a-f0-9-]+-audio\.mp3$/);
		expect(result2.key).toMatch(/[a-f0-9-]+-audio\.mp3$/);
	});
});
