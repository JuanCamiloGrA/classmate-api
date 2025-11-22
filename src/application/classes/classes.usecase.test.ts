import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Class,
	ClassListItem,
	ClassStatus,
	ClassWithResources,
} from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";
import { CreateClassUseCase } from "./create-class.usecase";
import { GetClassUseCase } from "./get-class.usecase";
import { HardDeleteClassUseCase } from "./hard-delete-class.usecase";
import { ListClassesUseCase } from "./list-classes.usecase";
import { SoftDeleteClassUseCase } from "./soft-delete-class.usecase";
import { UpdateClassUseCase } from "./update-class.usecase";

// Mock class data
const mockClass: Class = {
	id: "class-550e8400-e29b-41d4-a716-446655440000",
	userId: "user-123",
	subjectId: "subject-123",
	title: "Chapter 5 Introduction",
	startDate: "2024-10-20T09:00:00Z",
	endDate: "2024-10-20T10:30:00Z",
	link: "https://example.com/class/123",
	meetingLink: "https://example.com/meeting/123",
	status: "completed",
	aiStatus: "none",
	topics: '["Derivatives", "Integrals"]',
	durationSeconds: 5400,
	content: "Introduction to advanced concepts in mathematics",
	summary: "Covered chapter 5 topics including derivatives and integrals",
	transcriptionText: "Full transcription text",
	roomLocation: "Room 101",
	isProcessed: 0,
	isDeleted: 0,
	deletedAt: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockClassListItem: ClassListItem = {
	id: "class-550e8400-e29b-41d4-a716-446655440000",
	subjectId: "subject-123",
	title: "Chapter 5 Introduction",
	startDate: "2024-10-20T09:00:00Z",
	endDate: "2024-10-20T10:30:00Z",
	link: "https://example.com/class/123",
	meetingLink: "https://example.com/meeting/123",
	status: "completed",
	aiStatus: "none",
	topics: '["Derivatives", "Integrals"]',
	durationSeconds: 5400,
	roomLocation: "Room 101",
	isProcessed: 0,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockClassWithResources: ClassWithResources = {
	...mockClass,
	resources: [
		{
			id: "file-1",
			originalFilename: "lecture-slides.pdf",
			mimeType: "application/pdf",
			sizeBytes: 5242880,
			associationType: "resource",
		},
		{
			id: "file-2",
			originalFilename: "class-notes.txt",
			mimeType: "text/plain",
			sizeBytes: 102400,
			associationType: "embedded_content",
		},
	],
};

const mockClassDeleted: Class = {
	...mockClass,
	isDeleted: 1,
	deletedAt: "2024-10-16T10:05:00.000Z",
	updatedAt: "2024-10-16T10:05:00.000Z",
};

describe("Classes Use Cases", () => {
	let mockRepository: ClassRepository;

	beforeEach(() => {
		mockRepository = {
			findAll: vi.fn(),
			findByIdAndUserId: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			softDelete: vi.fn(),
			hardDelete: vi.fn(),
		} as unknown as ClassRepository;
	});

	describe("ListClassesUseCase", () => {
		it("should list classes with default filters", async () => {
			const classesResult = { data: [mockClassListItem], total: 1 };
			(mockRepository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue(
				classesResult,
			);

			const useCase = new ListClassesUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				subjectId: "subject-123",
			});

			expect(result).toEqual(classesResult);
			expect(mockRepository.findAll).toHaveBeenCalledWith("user-123", {
				subjectId: "subject-123",
			});
		});

		it("should return empty result when no classes match", async () => {
			const emptyResult = { data: [], total: 0 };
			(mockRepository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue(
				emptyResult,
			);

			const useCase = new ListClassesUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				subjectId: "subject-456",
			});

			expect(result).toEqual(emptyResult);
		});

		it("should support advanced filters", async () => {
			const classes = [
				mockClassListItem,
				{
					...mockClassListItem,
					id: "class-2",
					title: "Advanced Topics",
					startDate: "2024-10-21T09:00:00Z",
					endDate: "2024-10-21T10:30:00Z",
				},
			];
			const filters = {
				subjectId: "subject-123",
				status: ["completed" as ClassStatus],
				startDateFrom: "2024-10-01T00:00:00Z",
				startDateTo: "2024-10-31T23:59:59Z",
			};
			(mockRepository.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
				data: classes,
				total: classes.length,
			});

			const useCase = new ListClassesUseCase(mockRepository);
			const result = await useCase.execute("user-123", filters);

			expect(result.data).toHaveLength(2);
			expect(result.data[0].title).toBe("Chapter 5 Introduction");
			expect(mockRepository.findAll).toHaveBeenCalledWith("user-123", filters);
		});
	});

	describe("GetClassUseCase", () => {
		it("should get a class with resources by ID", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockClassWithResources);

			const useCase = new GetClassUseCase(mockRepository);
			const result = await useCase.execute(
				"user-123",
				"class-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result).toEqual(mockClassWithResources);
			expect(result.resources).toHaveLength(2);
			expect(result.resources[0].originalFilename).toBe("lecture-slides.pdf");
			expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
				"user-123",
				"class-550e8400-e29b-41d4-a716-446655440000",
			);
		});

		it("should get a class with empty resources", async () => {
			const classNoResources: ClassWithResources = {
				...mockClass,
				resources: [],
			};
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(classNoResources);

			const useCase = new GetClassUseCase(mockRepository);
			const result = await useCase.execute(
				"user-123",
				"class-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result.resources).toEqual([]);
		});

		it("should return null if class does not exist", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);

			const useCase = new GetClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", "non-existent-id");

			expect(result).toBeNull();
		});

		it("should return null if class does not belong to user", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(null);

			const useCase = new GetClassUseCase(mockRepository);
			const result = await useCase.execute(
				"wrong-user",
				"class-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result).toBeNull();
		});

		it("should include content and summary in response", async () => {
			(
				mockRepository.findByIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockClassWithResources);

			const useCase = new GetClassUseCase(mockRepository);
			const result = await useCase.execute(
				"user-123",
				"class-550e8400-e29b-41d4-a716-446655440000",
			);

			expect(result.content).toBe(
				"Introduction to advanced concepts in mathematics",
			);
			expect(result.summary).toBe(
				"Covered chapter 5 topics including derivatives and integrals",
			);
		});
	});

	describe("CreateClassUseCase", () => {
		it("should create a class with required fields only", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClass,
			);

			const useCase = new CreateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				subjectId: "subject-123",
			});

			expect(result).toEqual(mockClass);
			expect(mockRepository.create).toHaveBeenCalledWith("user-123", {
				subjectId: "subject-123",
			});
		});

		it("should create a class with all fields", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClass,
			);

			const useCase = new CreateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				subjectId: "subject-123",
				title: "Chapter 5 Introduction",
				startDate: "2024-10-20T09:00:00Z",
				endDate: "2024-10-20T10:30:00Z",
				link: "https://example.com/class/123",
				content: "Introduction to advanced concepts in mathematics",
				summary: "Covered chapter 5 topics including derivatives and integrals",
			});

			expect(result).toEqual(mockClass);
		});

		it("should support null fields", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClass,
			);

			const useCase = new CreateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				subjectId: "subject-123",
				title: "Chapter 5 Introduction",
				startDate: null,
				endDate: null,
				link: null,
				content: null,
				summary: null,
			});

			expect(result).toEqual(mockClass);
		});
	});

	describe("UpdateClassUseCase", () => {
		it("should update class title only", async () => {
			const updated = { ...mockClass, title: "Updated Title" };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id, {
				title: "Updated Title",
			});

			expect(result.title).toBe("Updated Title");
			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockClass.id,
				{ title: "Updated Title" },
			);
		});

		it("should update class dates", async () => {
			const newStart = "2024-10-21T10:00:00Z";
			const newEnd = "2024-10-21T11:30:00Z";
			const updated = {
				...mockClass,
				startDate: newStart,
				endDate: newEnd,
			};
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id, {
				startDate: newStart,
				endDate: newEnd,
			});

			expect(result.startDate).toBe(newStart);
			expect(result.endDate).toBe(newEnd);
		});

		it("should update class content and summary", async () => {
			const newContent = "New class content";
			const newSummary = "New summary";
			const updated = {
				...mockClass,
				content: newContent,
				summary: newSummary,
			};
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id, {
				content: newContent,
				summary: newSummary,
			});

			expect(result.content).toBe(newContent);
			expect(result.summary).toBe(newSummary);
		});

		it("should update multiple fields", async () => {
			const updated = {
				...mockClass,
				title: "Updated Title",
				content: "Updated content",
				link: "https://new-link.com",
			};
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id, {
				title: "Updated Title",
				content: "Updated content",
				link: "https://new-link.com",
			});

			expect(result.title).toBe("Updated Title");
			expect(result.content).toBe("Updated content");
			expect(result.link).toBe("https://new-link.com");
		});

		it("should allow setting fields to null", async () => {
			const updated = { ...mockClass, content: null, summary: null };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updated,
			);

			const useCase = new UpdateClassUseCase(mockRepository);
			await useCase.execute("user-123", mockClass.id, {
				content: null,
				summary: null,
			});

			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockClass.id,
				{ content: null, summary: null },
			);
		});

		it("should throw error if class not found", async () => {
			const error = new Error("Class not found");
			(mockRepository.update as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new UpdateClassUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id", { title: "New" }),
			).rejects.toThrow("Class not found");
		});
	});

	describe("SoftDeleteClassUseCase", () => {
		it("should soft delete a class", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClassDeleted,
			);

			const useCase = new SoftDeleteClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id);

			expect(result.isDeleted).toBe(1);
			expect(result.deletedAt).toBeTruthy();
			expect(mockRepository.softDelete).toHaveBeenCalledWith(
				"user-123",
				mockClass.id,
			);
		});

		it("should throw error if class not found", async () => {
			const error = new Error("Class not found");
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new SoftDeleteClassUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Class not found");
		});

		it("should preserve class data after soft delete", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClassDeleted,
			);

			const useCase = new SoftDeleteClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id);

			// Verify original data is preserved
			expect(result.title).toBe(mockClass.title);
			expect(result.content).toBe(mockClass.content);
			expect(result.summary).toBe(mockClass.summary);
			expect(result.subjectId).toBe(mockClass.subjectId);
		});
	});

	describe("HardDeleteClassUseCase", () => {
		it("should hard delete a class", async () => {
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockClass,
			);

			const useCase = new HardDeleteClassUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockClass.id);

			expect(result.id).toEqual(mockClass.id);
			expect(mockRepository.hardDelete).toHaveBeenCalledWith(
				"user-123",
				mockClass.id,
			);
		});

		it("should throw error if class not found", async () => {
			const error = new Error("Class not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteClassUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Class not found");
		});

		it("should throw error if class belongs to different user", async () => {
			const error = new Error("Class not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteClassUseCase(mockRepository);

			await expect(useCase.execute("wrong-user", mockClass.id)).rejects.toThrow(
				"Class not found",
			);
		});
	});
});
