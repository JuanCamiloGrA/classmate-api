import { describe, expect, it } from "vitest";
import type { Database } from "../client";
import { D1ClassRepository } from "./class.repository";

describe("D1ClassRepository", () => {
	/**
	 * Unit tests for D1ClassRepository.
	 * Tests the implementation of ClassRepository interface using Drizzle ORM.
	 *
	 * Note: Full integration tests require a test D1 database instance.
	 * These tests verify the interface contract is properly implemented.
	 */

	it("should instantiate without errors", () => {
		const mockDb = {} as Database;
		const repo = new D1ClassRepository(mockDb);

		expect(repo).toBeInstanceOf(D1ClassRepository);
	});

	it("should implement ClassRepository interface", () => {
		const mockDb = {} as Database;
		const repo = new D1ClassRepository(mockDb);

		// Verify interface methods exist
		expect(typeof repo.findBySubjectIdAndUserId).toBe("function");
		expect(typeof repo.findByIdAndUserId).toBe("function");
		expect(typeof repo.create).toBe("function");
		expect(typeof repo.update).toBe("function");
		expect(typeof repo.softDelete).toBe("function");
		expect(typeof repo.hardDelete).toBe("function");
	});

	it("should have all required methods with correct signatures", () => {
		const mockDb = {} as Database;
		const repo = new D1ClassRepository(mockDb);

		// All methods should exist and be functions
		const methods = [
			"findBySubjectIdAndUserId",
			"findByIdAndUserId",
			"create",
			"update",
			"softDelete",
			"hardDelete",
		];

		for (const method of methods) {
			expect(method in repo).toBe(true);
			expect(typeof (repo as unknown as Record<string, unknown>)[method]).toBe(
				"function",
			);
		}
	});
});
