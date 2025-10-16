import { describe, expect, it, vi } from "vitest";
import type { Profile } from "../../domain/entities/profile";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import { GetProfileUseCase } from "./get-profile.usecase";

describe("GetProfileUseCase", () => {
	const mockProfile: Profile = {
		id: "user_123",
		email: "test@example.com",
		name: "Test User",
		subscriptionTier: "free",
		storageUsedBytes: 0,
		createdAt: "2025-10-16T12:00:00Z",
		updatedAt: "2025-10-16T12:00:00Z",
	};

	it("should retrieve a profile by user ID", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn().mockResolvedValue(mockProfile),
			create: vi.fn(),
			existsById: vi.fn(),
		};

		const useCase = new GetProfileUseCase(mockRepository);
		const result = await useCase.execute("user_123");

		expect(result).toEqual(mockProfile);
		expect(mockRepository.findById).toHaveBeenCalledWith("user_123");
	});

	it("should throw error when profile not found", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn().mockResolvedValue(null),
			create: vi.fn(),
			existsById: vi.fn(),
		};

		const useCase = new GetProfileUseCase(mockRepository);

		await expect(useCase.execute("user_123")).rejects.toThrow(
			"Profile not found",
		);
	});

	it("should return profile with all fields populated", async () => {
		const profileWithAllFields: Profile = {
			id: "user_456",
			email: "user@example.com",
			name: "John Doe",
			subscriptionTier: "pro",
			storageUsedBytes: 1024000,
			createdAt: "2025-01-01T00:00:00Z",
			updatedAt: "2025-10-16T12:00:00Z",
		};

		const mockRepository: ProfileRepository = {
			findById: vi.fn().mockResolvedValue(profileWithAllFields),
			create: vi.fn(),
			existsById: vi.fn(),
		};

		const useCase = new GetProfileUseCase(mockRepository);
		const result = await useCase.execute("user_456");

		expect(result).toEqual(profileWithAllFields);
		expect(result.subscriptionTier).toBe("pro");
		expect(result.storageUsedBytes).toBe(1024000);
	});

	it("should propagate repository errors", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn().mockRejectedValue(new Error("Database error")),
			create: vi.fn(),
			existsById: vi.fn(),
		};

		const useCase = new GetProfileUseCase(mockRepository);

		await expect(useCase.execute("user_123")).rejects.toThrow("Database error");
	});
});
