import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Subject } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";
import { CreateSubjectUseCase } from "./create-subject.usecase";
import { HardDeleteSubjectUseCase } from "./hard-delete-subject.usecase";
import { ListSubjectsUseCase } from "./list-subjects.usecase";
import { SoftDeleteSubjectUseCase } from "./soft-delete-subject.usecase";
import { UpdateSubjectUseCase } from "./update-subject.usecase";

// Mock subject data
const mockSubject: Subject = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	userId: "user-123",
	termId: "term-123",
	name: "Mathematics",
	isDeleted: 0,
	deletedAt: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockSubjectDeleted: Subject = {
	...mockSubject,
	isDeleted: 1,
	deletedAt: "2024-10-16T10:05:00.000Z",
	updatedAt: "2024-10-16T10:05:00.000Z",
};

describe("Subjects Use Cases", () => {
	let mockRepository: SubjectRepository;

	beforeEach(() => {
		mockRepository = {
			findByTermIdAndUserId: vi.fn(),
			findByIdAndUserId: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			softDelete: vi.fn(),
			hardDelete: vi.fn(),
		} as unknown as SubjectRepository;
	});

	describe("ListSubjectsUseCase", () => {
		it("should list all non-deleted subjects for a term", async () => {
			const subjects = [mockSubject];
			(
				mockRepository.findByTermIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(subjects);

			const useCase = new ListSubjectsUseCase(mockRepository);
			const result = await useCase.execute("user-123", "term-123");

			expect(result).toEqual(subjects);
			expect(mockRepository.findByTermIdAndUserId).toHaveBeenCalledWith(
				"user-123",
				"term-123",
			);
		});

		it("should return empty array if term has no subjects", async () => {
			(
				mockRepository.findByTermIdAndUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue([]);

			const useCase = new ListSubjectsUseCase(mockRepository);
			const result = await useCase.execute("user-123", "term-456");

			expect(result).toEqual([]);
		});
	});

	describe("CreateSubjectUseCase", () => {
		it("should create a subject with valid input", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockSubject,
			);

			const useCase = new CreateSubjectUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				name: "Mathematics",
				termId: "term-123",
			});

			expect(result).toEqual(mockSubject);
			expect(mockRepository.create).toHaveBeenCalledWith("user-123", {
				name: "Mathematics",
				termId: "term-123",
			});
		});

		it("should throw error for invalid input", async () => {
			const useCase = new CreateSubjectUseCase(mockRepository);

			// Missing name (empty string)
			await expect(
				useCase.execute("user-123", { name: "", termId: "term-123" }),
			).rejects.toThrow();

			// Missing termId
			await expect(
				useCase.execute("user-123", { name: "Math", termId: "" }),
			).rejects.toThrow();
		});
	});

	describe("UpdateSubjectUseCase", () => {
		it("should update a subject with valid input", async () => {
			const updatedSubject = { ...mockSubject, name: "Advanced Mathematics" };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updatedSubject,
			);

			const useCase = new UpdateSubjectUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockSubject.id, {
				name: "Advanced Mathematics",
			});

			expect(result).toEqual(updatedSubject);
		});

		it("should throw error if no fields provided for update", async () => {
			const useCase = new UpdateSubjectUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockSubject.id, {}),
			).rejects.toThrow("At least one field must be provided for update");
		});

		it("should update only the provided fields", async () => {
			const updatedSubject = { ...mockSubject, name: "Physics" };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updatedSubject,
			);

			const useCase = new UpdateSubjectUseCase(mockRepository);
			await useCase.execute("user-123", mockSubject.id, { name: "Physics" });

			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockSubject.id,
				{
					name: "Physics",
				},
			);
		});
	});

	describe("SoftDeleteSubjectUseCase", () => {
		it("should soft delete a subject", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockSubjectDeleted,
			);

			const useCase = new SoftDeleteSubjectUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockSubject.id);

			expect(result.isDeleted).toBe(1);
			expect(result.deletedAt).toBeTruthy();
			expect(mockRepository.softDelete).toHaveBeenCalledWith(
				"user-123",
				mockSubject.id,
			);
		});

		it("should throw error if subject not found", async () => {
			const error = new Error("Subject not found");
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new SoftDeleteSubjectUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Subject not found");
		});
	});

	describe("HardDeleteSubjectUseCase", () => {
		it("should hard delete a subject", async () => {
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockSubject,
			);

			const useCase = new HardDeleteSubjectUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockSubject.id);

			expect(result.id).toEqual(mockSubject.id);
			expect(mockRepository.hardDelete).toHaveBeenCalledWith(
				"user-123",
				mockSubject.id,
			);
		});

		it("should throw error if subject not found", async () => {
			const error = new Error("Subject not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteSubjectUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Subject not found");
		});
	});
});
