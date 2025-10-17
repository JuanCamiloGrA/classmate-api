import { describe, expect, it } from "vitest";
import type { Database } from "../client";
import { D1SubjectRepository } from "./subject.repository";

describe("D1SubjectRepository", () => {
	/**
	 * Unit tests for D1SubjectRepository.
	 * Tests the implementation of SubjectRepository interface using Drizzle ORM.
	 *
	 * Note: Full integration tests require a test D1 database instance.
	 * These tests verify the interface contract is properly implemented.
	 */

	it("should instantiate without errors", () => {
		const mockDb = {} as Database;
		const repo = new D1SubjectRepository(mockDb);

		expect(repo).toBeInstanceOf(D1SubjectRepository);
	});

	it("should implement SubjectRepository interface", () => {
		const mockDb = {} as Database;
		const repo = new D1SubjectRepository(mockDb);

		// Verify interface methods exist
		expect(typeof repo.findByTermIdAndUserId).toBe("function");
		expect(typeof repo.findByIdAndUserId).toBe("function");
		expect(typeof repo.create).toBe("function");
		expect(typeof repo.update).toBe("function");
		expect(typeof repo.softDelete).toBe("function");
		expect(typeof repo.hardDelete).toBe("function");
	});
});
