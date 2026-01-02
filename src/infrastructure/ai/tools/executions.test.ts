/**
 * Tool Executions Unit Tests
 * Tests for HITL tool execution functions
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: Test file uses any for mock contexts and type assertions */
import { describe, expect, it, vi } from "vitest";
import type { ClassRepository } from "../../../domain/repositories/class.repository";
import type { TaskRepository } from "../../../domain/repositories/task.repository";
import type { ToolDependencies } from "./definitions";
import { createExecutions, hitlToolNames } from "./executions";

// ============================================
// MOCK FACTORIES
// ============================================

function createMockClassRepository(): ClassRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi
			.fn()
			.mockResolvedValue({ id: "class-123", title: "Updated Title" }),
		softDelete: vi.fn(),
		hardDelete: vi
			.fn()
			.mockResolvedValue({ id: "class-123", title: "Test Class" }),
	};
}

function createMockTaskRepository(): TaskRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findBySubjectIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi.fn().mockResolvedValue({
			id: "task-123",
			title: "Updated Task",
			status: "done",
		}),
		softDelete: vi.fn(),
		hardDelete: vi
			.fn()
			.mockResolvedValue({ id: "task-123", title: "Test Task" }),
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

describe("Tool Executions", () => {
	describe("hitlToolNames", () => {
		it("should include deleteClass", () => {
			expect(hitlToolNames).toContain("deleteClass");
		});

		it("should include updateClass", () => {
			expect(hitlToolNames).toContain("updateClass");
		});

		it("should include deleteTask", () => {
			expect(hitlToolNames).toContain("deleteTask");
		});

		it("should include updateTask", () => {
			expect(hitlToolNames).toContain("updateTask");
		});
	});

	describe("deleteClass execution", () => {
		const mockContext = {
			messages: [],
			toolCallId: "test-call-id",
		} as any;

		it("should execute successfully with classId", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);

			const result = (await executions.deleteClass(
				{ classId: "class-123" },
				mockContext,
			)) as { success: boolean; message: string; deletedId: string };

			expect(result).toEqual({
				success: true,
				message: 'Class "Test Class" has been permanently deleted.',
				deletedId: "class-123",
			});
			expect(deps.classRepository.hardDelete).toHaveBeenCalledWith(
				"test-user-id",
				"class-123",
			);
		});

		it("should execute successfully with classId and reason", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = (await executions.deleteClass(
				{ classId: "class-456", reason: "No longer needed" },
				mockContext,
			)) as { success: boolean };

			expect(result.success).toBe(true);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("No longer needed"),
			);

			consoleSpy.mockRestore();
		});

		it("should handle errors gracefully", async () => {
			const deps = createMockDependencies();
			(deps.classRepository.hardDelete as any).mockRejectedValue(
				new Error("Class not found"),
			);
			const executions = createExecutions(deps);

			const result = (await executions.deleteClass(
				{ classId: "non-existent" },
				mockContext,
			)) as { success: boolean; error: string };

			expect(result).toEqual({
				success: false,
				error: "Class not found",
			});
		});
	});

	describe("updateClass execution", () => {
		const mockContext = {
			messages: [],
			toolCallId: "test-call-id",
		} as any;

		it("should update class successfully", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);

			const result = (await executions.updateClass(
				{ classId: "class-123", title: "Updated Title" },
				mockContext,
			)) as { success: boolean; message: string };

			expect(result.success).toBe(true);
			expect(result.message).toContain("Updated Title");
			expect(deps.classRepository.update).toHaveBeenCalledWith(
				"test-user-id",
				"class-123",
				{ title: "Updated Title" },
			);
		});
	});

	describe("deleteTask execution", () => {
		const mockContext = {
			messages: [],
			toolCallId: "test-call-id",
		} as any;

		it("should execute successfully with taskId", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);

			const result = (await executions.deleteTask(
				{ taskId: "task-123" },
				mockContext,
			)) as { success: boolean; message: string; deletedId: string };

			expect(result).toEqual({
				success: true,
				message: 'Task "Test Task" has been permanently deleted.',
				deletedId: "task-123",
			});
			expect(deps.taskRepository.hardDelete).toHaveBeenCalledWith(
				"test-user-id",
				"task-123",
			);
		});
	});

	describe("updateTask execution", () => {
		const mockContext = {
			messages: [],
			toolCallId: "test-call-id",
		} as any;

		it("should update task successfully", async () => {
			const deps = createMockDependencies();
			const executions = createExecutions(deps);

			const result = (await executions.updateTask(
				{ taskId: "task-123", status: "done" },
				mockContext,
			)) as { success: boolean; message: string };

			expect(result.success).toBe(true);
			expect(result.message).toContain("Updated Task");
			expect(deps.taskRepository.update).toHaveBeenCalledWith(
				"test-user-id",
				"task-123",
				{ status: "done" },
			);
		});
	});
});
