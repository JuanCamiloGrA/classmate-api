import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Term } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";
import { CreateTermUseCase } from "./create-term.usecase";
import { HardDeleteTermUseCase } from "./hard-delete-term.usecase";
import { ListTermsUseCase } from "./list-terms.usecase";
import { SoftDeleteTermUseCase } from "./soft-delete-term.usecase";
import { UpdateTermUseCase } from "./update-term.usecase";

// Mock term data
const mockTerm: Term = {
	id: "550e8400-e29b-41d4-a716-446655440000",
	userId: "user-123",
	name: "Fall 2024",
	order: 0,
	isDeleted: 0,
	deletedAt: null,
	createdAt: "2024-10-16T10:00:00.000Z",
	updatedAt: "2024-10-16T10:00:00.000Z",
};

const mockTermDeleted: Term = {
	...mockTerm,
	isDeleted: 1,
	deletedAt: "2024-10-16T10:05:00.000Z",
	updatedAt: "2024-10-16T10:05:00.000Z",
};

describe("Terms Use Cases", () => {
	let mockRepository: TermRepository;

	beforeEach(() => {
		mockRepository = {
			findByUserId: vi.fn(),
			findByIdAndUserId: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			softDelete: vi.fn(),
			hardDelete: vi.fn(),
		} as unknown as TermRepository;
	});

	describe("ListTermsUseCase", () => {
		it("should list all non-deleted terms for a user", async () => {
			const terms = [mockTerm];
			(
				mockRepository.findByUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue(terms);

			const useCase = new ListTermsUseCase(mockRepository);
			const result = await useCase.execute("user-123");

			expect(result).toEqual(terms);
			expect(mockRepository.findByUserId).toHaveBeenCalledWith("user-123");
		});

		it("should return empty array if user has no terms", async () => {
			(
				mockRepository.findByUserId as ReturnType<typeof vi.fn>
			).mockResolvedValue([]);

			const useCase = new ListTermsUseCase(mockRepository);
			const result = await useCase.execute("user-456");

			expect(result).toEqual([]);
		});
	});

	describe("CreateTermUseCase", () => {
		it("should create a term with valid input", async () => {
			(mockRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTerm,
			);

			const useCase = new CreateTermUseCase(mockRepository);
			const result = await useCase.execute("user-123", {
				name: "Fall 2024",
				order: 0,
			});

			expect(result).toEqual(mockTerm);
			expect(mockRepository.create).toHaveBeenCalledWith("user-123", {
				name: "Fall 2024",
				order: 0,
			});
		});

		it("should throw error for invalid input", async () => {
			const useCase = new CreateTermUseCase(mockRepository);

			// Missing name (empty string)
			await expect(
				useCase.execute("user-123", { name: "", order: 0 }),
			).rejects.toThrow();

			// Negative order
			await expect(
				useCase.execute("user-123", { name: "Valid", order: -1 }),
			).rejects.toThrow();
		});
	});

	describe("UpdateTermUseCase", () => {
		it("should update a term with valid input", async () => {
			const updatedTerm = { ...mockTerm, name: "Updated Name" };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updatedTerm,
			);

			const useCase = new UpdateTermUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTerm.id, {
				name: "Updated Name",
			});

			expect(result).toEqual(updatedTerm);
		});

		it("should throw error if no fields provided for update", async () => {
			const useCase = new UpdateTermUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", mockTerm.id, {}),
			).rejects.toThrow("No fields provided to update");
		});

		it("should update only the provided fields", async () => {
			const updatedTerm = { ...mockTerm, order: 5 };
			(mockRepository.update as ReturnType<typeof vi.fn>).mockResolvedValue(
				updatedTerm,
			);

			const useCase = new UpdateTermUseCase(mockRepository);
			await useCase.execute("user-123", mockTerm.id, { order: 5 });

			expect(mockRepository.update).toHaveBeenCalledWith(
				"user-123",
				mockTerm.id,
				{
					order: 5,
				},
			);
		});
	});

	describe("SoftDeleteTermUseCase", () => {
		it("should soft delete a term", async () => {
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTermDeleted,
			);

			const useCase = new SoftDeleteTermUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTerm.id);

			expect(result.isDeleted).toBe(1);
			expect(result.deletedAt).toBeTruthy();
			expect(mockRepository.softDelete).toHaveBeenCalledWith(
				"user-123",
				mockTerm.id,
			);
		});

		it("should throw error if term not found", async () => {
			const error = new Error("Term not found");
			(mockRepository.softDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new SoftDeleteTermUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Term not found");
		});
	});

	describe("HardDeleteTermUseCase", () => {
		it("should hard delete a term", async () => {
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockResolvedValue(
				mockTerm,
			);

			const useCase = new HardDeleteTermUseCase(mockRepository);
			const result = await useCase.execute("user-123", mockTerm.id);

			expect(result.id).toEqual(mockTerm.id);
			expect(mockRepository.hardDelete).toHaveBeenCalledWith(
				"user-123",
				mockTerm.id,
			);
		});

		it("should throw error if term not found", async () => {
			const error = new Error("Term not found");
			(mockRepository.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValue(
				error,
			);

			const useCase = new HardDeleteTermUseCase(mockRepository);

			await expect(
				useCase.execute("user-123", "non-existent-id"),
			).rejects.toThrow("Term not found");
		});
	});
});
