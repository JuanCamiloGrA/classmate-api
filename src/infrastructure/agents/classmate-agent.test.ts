/**
 * ClassmateAgent Unit Tests
 * Tests for the agent's core functionality
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: Test file uses any for mock contexts and type assertions */
import { describe, expect, it, vi } from "vitest";
import type { ClassRepository } from "../../domain/repositories/class.repository";
import type { TaskRepository } from "../../domain/repositories/task.repository";
import { APPROVAL } from "../ai/shared";
import type { ToolDependencies } from "../ai/tools/definitions";
import { createExecutions, hitlToolNames } from "../ai/tools/executions";
import { cleanupMessages } from "../ai/utils";

// ============================================
// MOCK FACTORIES
// ============================================

function createMockClassRepository(): ClassRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		hardDelete: vi
			.fn()
			.mockResolvedValue({ id: "test-id", title: "Test Class" }),
	};
}

function createMockTaskRepository(): TaskRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findBySubjectIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		hardDelete: vi
			.fn()
			.mockResolvedValue({ id: "test-id", title: "Test Task" }),
	};
}

function createMockDependencies(): ToolDependencies {
	return {
		userId: "test-user-id",
		classRepository: createMockClassRepository(),
		taskRepository: createMockTaskRepository(),
	};
}

// ============================================
// TESTS
// ============================================

describe("ClassmateAgent HITL Flow", () => {
	describe("cleanupMessages", () => {
		it("should filter out messages with incomplete tool calls (input-streaming)", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-deleteClass",
							state: "input-streaming",
							toolCallId: "call-1",
							input: { classId: "123" },
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			// The message with incomplete tool call should be removed
			expect(cleaned).toHaveLength(1);
			expect(cleaned[0].role).toBe("user");
		});

		it("should filter out messages with input-available but no output", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-deleteClass",
							state: "input-available",
							toolCallId: "call-1",
							input: { classId: "123" },
							// No output or errorText - incomplete
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(1);
			expect(cleaned[0].role).toBe("user");
		});

		it("should keep messages with completed tool results (output-available)", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-deleteClass",
							state: "output-available",
							toolCallId: "call-1",
							input: { classId: "123" },
							output: { success: true },
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(2);
		});

		it("should keep messages without parts", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(2);
		});
	});

	describe("Tool Executions Registry", () => {
		it("should have deleteClass registered", () => {
			expect(hitlToolNames).toContain("deleteClass");
		});

		it("should have updateClass registered", () => {
			expect(hitlToolNames).toContain("updateClass");
		});

		it("should have deleteTask registered", () => {
			expect(hitlToolNames).toContain("deleteTask");
		});

		it("should have updateTask registered", () => {
			expect(hitlToolNames).toContain("updateTask");
		});

		it("should execute deleteClass successfully", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);
			const mockContext = {
				messages: [],
				toolCallId: "test-call-id",
			} as any;

			const result = (await executions.deleteClass(
				{ classId: "test-id", reason: "Testing" },
				mockContext,
			)) as { success: boolean; deletedId: string };

			expect(result).toHaveProperty("success", true);
			expect(result).toHaveProperty("deletedId", "test-id");
		});
	});

	describe("APPROVAL constants", () => {
		it("should have YES and NO values", () => {
			expect(APPROVAL.YES).toBe("Yes, confirmed.");
			expect(APPROVAL.NO).toBe("No, denied.");
		});
	});
});
