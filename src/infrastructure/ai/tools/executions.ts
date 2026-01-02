/**
 * Tool Executions for HITL (Human-in-the-Loop) Tools
 *
 * This file contains the actual execution logic for tools that require
 * user confirmation before running. Each function here corresponds to
 * a tool that doesn't have an execute function.
 *
 * The flow is:
 * 1. AI calls tool (e.g., deleteClass) → no execute function
 * 2. Client shows confirmation UI to user
 * 3. User approves/denies
 * 4. processToolCalls() calls the matching function here
 *
 * Factory pattern is used to inject dependencies (repositories, userId)
 */

import type { ToolExecutions } from "../utils";
import type { ToolDependencies } from "./definitions";

// ============================================
// INPUT TYPES (matching tool schemas)
// ============================================

interface DeleteClassInput {
	classId: string;
	reason?: string;
}

interface UpdateClassInput {
	classId: string;
	title?: string;
	startDate?: string;
	endDate?: string;
	status?: "scheduled" | "live" | "completed";
	link?: string;
	meetingLink?: string;
	roomLocation?: string;
	content?: string;
	topics?: string;
}

interface DeleteTaskInput {
	taskId: string;
	reason?: string;
}

interface UpdateTaskInput {
	taskId: string;
	title?: string;
	dueDate?: string;
	status?: "todo" | "doing" | "ai_review" | "done";
	priority?: "low" | "medium" | "high";
	content?: string;
	grade?: number;
}

// ============================================
// EXECUTION FACTORY
// ============================================

/**
 * Create execution implementations for HITL tools
 * These run AFTER user approval
 *
 * @param deps - Dependencies including userId and repositories
 */
export function createExecutions(deps: ToolDependencies): ToolExecutions {
	const { userId, classRepository, taskRepository } = deps;

	return {
		/**
		 * Delete a class - executes after user confirmation
		 */
		deleteClass: async (input: DeleteClassInput, _context) => {
			console.log(
				`[TOOL EXECUTION] deleteClass approved for classId: ${input.classId}, reason: ${input.reason || "none"}`,
			);

			try {
				const deletedClass = await classRepository.hardDelete(
					userId,
					input.classId,
				);

				return {
					success: true,
					message: `Class "${deletedClass.title || input.classId}" has been permanently deleted.`,
					deletedId: input.classId,
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to delete class";
				return {
					success: false,
					error: message,
				};
			}
		},

		/**
		 * Update a class - executes after user confirmation
		 */
		updateClass: async (input: UpdateClassInput, _context) => {
			console.log(
				`[TOOL EXECUTION] updateClass approved for classId: ${input.classId}`,
			);

			try {
				const { classId, ...updateData } = input;

				const updatedClass = await classRepository.update(
					userId,
					classId,
					updateData,
				);

				return {
					success: true,
					message: `Class "${updatedClass.title || classId}" has been updated.`,
					class: updatedClass,
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to update class";
				return {
					success: false,
					error: message,
				};
			}
		},

		/**
		 * Delete a task - executes after user confirmation
		 */
		deleteTask: async (input: DeleteTaskInput, _context) => {
			console.log(
				`[TOOL EXECUTION] deleteTask approved for taskId: ${input.taskId}, reason: ${input.reason || "none"}`,
			);

			try {
				const deletedTask = await taskRepository.hardDelete(
					userId,
					input.taskId,
				);

				return {
					success: true,
					message: `Task "${deletedTask.title || input.taskId}" has been permanently deleted.`,
					deletedId: input.taskId,
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to delete task";
				return {
					success: false,
					error: message,
				};
			}
		},

		/**
		 * Update a task - executes after user confirmation
		 */
		updateTask: async (input: UpdateTaskInput, _context) => {
			console.log(
				`[TOOL EXECUTION] updateTask approved for taskId: ${input.taskId}`,
			);

			try {
				const { taskId, ...updateData } = input;

				const updatedTask = await taskRepository.update(
					userId,
					taskId,
					updateData,
				);

				return {
					success: true,
					message: `Task "${updatedTask.title || taskId}" has been updated.`,
					task: updatedTask,
				};
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to update task";
				return {
					success: false,
					error: message,
				};
			}
		},
	};
}

/**
 * List of tool names that have HITL executions
 * Used for validation and type checking
 */
export const hitlToolNames = [
	"deleteClass",
	"updateClass",
	"deleteTask",
	"updateTask",
];
