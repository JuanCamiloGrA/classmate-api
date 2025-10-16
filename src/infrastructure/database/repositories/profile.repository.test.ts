import { describe, expect, it } from "vitest";
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
});
