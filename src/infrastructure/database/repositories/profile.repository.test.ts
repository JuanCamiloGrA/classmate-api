import { describe, expect, it, vi } from "vitest";
import type { Database } from "../client";
import { D1ProfileRepository } from "./profile.repository";

describe("D1ProfileRepository", () => {
	/**
	 * Unit tests for D1ProfileRepository.
	 * Tests the implementation of ProfileRepository interface using Drizzle ORM.
	 *
	 * Note: Full integration tests require a test D1 database instance.
	 * These tests verify the interface contract is properly implemented.
	 */

	it("should instantiate without errors", () => {
		const mockDb = {} as Database;
		const repo = new D1ProfileRepository(mockDb);

		expect(repo).toBeInstanceOf(D1ProfileRepository);
	});

	it("should implement ProfileRepository interface", () => {
		const mockDb = {} as Database;
		const repo = new D1ProfileRepository(mockDb);

		// Verify interface methods exist
		expect(typeof repo.findById).toBe("function");
		expect(typeof repo.create).toBe("function");
		expect(typeof repo.existsById).toBe("function");
	});

	const createDbStub = (result: unknown) =>
		({
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						get: vi.fn().mockResolvedValue(result),
					}),
				}),
			}),
		}) as unknown as Database;

	it("existsById should return false when profile is absent", async () => {
		const dbStub = createDbStub(undefined);
		const repo = new D1ProfileRepository(dbStub);

		const exists = await repo.existsById("user_123");

		expect(exists).toBe(false);
	});

	it("existsById should return true when profile is present", async () => {
		const dbStub = createDbStub({ id: "user_123" });
		const repo = new D1ProfileRepository(dbStub);

		const exists = await repo.existsById("user_123");

		expect(exists).toBe(true);
	});
});
