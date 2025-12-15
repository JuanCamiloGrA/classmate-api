import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../../domain/entities/profile";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import { CreateProfileUseCase } from "./create-profile.usecase";

describe("CreateProfileUseCase", () => {
	const mockProfile: Profile = {
		id: "user_123",
		email: "test@example.com",
		name: "Test User",
		subscriptionTier: "free",
		storageUsedBytes: 0,
		scribeStyleSlot1R2Key: null,
		scribeStyleSlot1MimeType: null,
		scribeStyleSlot1OriginalFilename: null,
		scribeStyleSlot2R2Key: null,
		scribeStyleSlot2MimeType: null,
		scribeStyleSlot2OriginalFilename: null,
		createdAt: "2025-10-16T12:00:00Z",
		updatedAt: "2025-10-16T12:00:00Z",
	};

	it("should create a profile when it does not exist", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn(),
			create: vi.fn().mockResolvedValue(mockProfile),
			existsById: vi.fn().mockResolvedValue(false),
			updateScribeStyleSlot: vi.fn(),
		};

		const useCase = new CreateProfileUseCase(mockRepository);
		const result = await useCase.execute({
			id: "user_123",
			email: "test@example.com",
			name: "Test User",
		});

		expect(result).toEqual(mockProfile);
		expect(mockRepository.existsById).toHaveBeenCalledWith("user_123");
		expect(mockRepository.create).toHaveBeenCalledWith({
			id: "user_123",
			email: "test@example.com",
			name: "Test User",
		});
	});

	it("should throw error when profile already exists", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn(),
			create: vi.fn(),
			existsById: vi.fn().mockResolvedValue(true),
			updateScribeStyleSlot: vi.fn(),
		};

		const useCase = new CreateProfileUseCase(mockRepository);

		await expect(
			useCase.execute({
				id: "user_123",
				email: "test@example.com",
				name: "Test User",
			}),
		).rejects.toThrow("Profile already exists");

		expect(mockRepository.create).not.toHaveBeenCalled();
	});

	it("should handle null email and name", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn(),
			create: vi.fn().mockResolvedValue({
				...mockProfile,
				email: null,
				name: null,
			}),
			existsById: vi.fn().mockResolvedValue(false),
			updateScribeStyleSlot: vi.fn(),
		};

		const useCase = new CreateProfileUseCase(mockRepository);
		const result = await useCase.execute({
			id: "user_123",
			email: null,
			name: null,
		});

		expect(result.email).toBeNull();
		expect(result.name).toBeNull();
	});

	it("should propagate repository errors", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn(),
			create: vi.fn().mockRejectedValue(new Error("Database error")),
			existsById: vi.fn().mockResolvedValue(false),
			updateScribeStyleSlot: vi.fn(),
		};

		const useCase = new CreateProfileUseCase(mockRepository);

		await expect(
			useCase.execute({
				id: "user_123",
				email: "test@example.com",
				name: "Test User",
			}),
		).rejects.toThrow("Database error");
	});
});
