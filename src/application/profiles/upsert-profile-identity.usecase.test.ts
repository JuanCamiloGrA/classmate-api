import { describe, expect, it, vi } from "vitest";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import { UpsertProfileIdentityUseCase } from "./upsert-profile-identity.usecase";

describe("UpsertProfileIdentityUseCase", () => {
	it("should delegate to repository", async () => {
		const mockRepository: ProfileRepository = {
			findById: vi.fn(),
			create: vi.fn(),
			existsById: vi.fn(),
			upsertIdentityFromWebhook: vi
				.fn()
				.mockResolvedValue({ action: "updated", profileId: "user_123" }),
			updateScribeStyleSlot: vi.fn(),
		};

		const useCase = new UpsertProfileIdentityUseCase(mockRepository);
		const result = await useCase.execute({
			id: "user_123",
			email: "john@example.com",
			name: "John Doe",
		});

		expect(result).toEqual({ action: "updated", profileId: "user_123" });
		expect(mockRepository.upsertIdentityFromWebhook).toHaveBeenCalledWith({
			id: "user_123",
			email: "john@example.com",
			name: "John Doe",
		});
	});
});
