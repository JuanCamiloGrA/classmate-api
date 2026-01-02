/**
 * Task-related Tools for ClassmateAgent
 * Factory pattern for dependency injection of repositories
 * Includes both automatic and HITL (Human-in-the-Loop) tools
 */
import { tool } from "ai";
import { z } from "zod";
import type { TaskRepository } from "../../../domain/repositories/task.repository";
import {
	errorResult,
	successResult,
	type ToolDependencies,
	type ToolMetadata,
} from "./definitions";

// ============================================
// TOOL METADATA
// ============================================

export const listTasksMeta: ToolMetadata = {
	name: "listTasks",
	description:
		"List all tasks for the user with pagination and filtering options. Returns task metadata without content field for efficiency.",
	requiresConfirmation: false,
	category: "task",
};

export const getTaskMeta: ToolMetadata = {
	name: "getTask",
	description:
		"Get a single task with all its fields including content and resources. Use this to read full task details.",
	requiresConfirmation: false,
	category: "task",
};

export const createTaskMeta: ToolMetadata = {
	name: "createTask",
	description: "Create a new task/assignment for a subject.",
	requiresConfirmation: false,
	category: "task",
};

export const deleteTaskMeta: ToolMetadata = {
	name: "deleteTask",
	description:
		"Permanently delete a task and all its associated resources. This action is irreversible.",
	requiresConfirmation: true, // HITL - requires user approval
	category: "task",
};

export const updateTaskMeta: ToolMetadata = {
	name: "updateTask",
	description:
		"Update an existing task fields like title, due date, status, priority, content, etc.",
	requiresConfirmation: true, // HITL - requires user approval
	category: "task",
};

/** Metadata for all task tools */
export const taskToolsMeta: ToolMetadata[] = [
	listTasksMeta,
	getTaskMeta,
	createTaskMeta,
	deleteTaskMeta,
	updateTaskMeta,
];

/** Names of tools that require HITL confirmation */
export const taskToolsRequiringConfirmation = taskToolsMeta
	.filter((m) => m.requiresConfirmation)
	.map((m) => m.name);

// ============================================
// ZOD SCHEMAS (for filtering/pagination)
// ============================================

const taskStatusSchema = z.enum(["todo", "doing", "ai_review", "done"]);
const taskPrioritySchema = z.enum(["low", "medium", "high"]);
const sortBySchema = z.enum(["dueDate", "createdAt", "priority"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

// ============================================
// INPUT SCHEMAS
// ============================================

export const listTasksInputSchema = z.object({
	subjectId: z.string().optional().describe("Filter by subject ID"),
	status: z
		.array(taskStatusSchema)
		.optional()
		.describe("Filter by task status(es): todo, doing, ai_review, done"),
	priority: z
		.array(taskPrioritySchema)
		.optional()
		.describe("Filter by priority level(s): low, medium, high"),
	search: z.string().optional().describe("Search by title (case-insensitive)"),
	dueDateFrom: z
		.string()
		.optional()
		.describe("Filter tasks due from this date (ISO 8601)"),
	dueDateTo: z
		.string()
		.optional()
		.describe("Filter tasks due before this date (ISO 8601)"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.default(20)
		.describe("Max results to return (1-100, default 20)"),
	offset: z
		.number()
		.min(0)
		.optional()
		.default(0)
		.describe("Number of results to skip for pagination"),
	sortBy: sortBySchema
		.optional()
		.default("dueDate")
		.describe("Sort field: dueDate, createdAt, or priority"),
	sortOrder: sortOrderSchema
		.optional()
		.default("asc")
		.describe("Sort order: asc or desc"),
});

export const getTaskInputSchema = z.object({
	taskId: z.string().describe("The unique identifier of the task"),
});

export const createTaskInputSchema = z.object({
	subjectId: z.string().describe("Subject ID this task belongs to"),
	title: z.string().describe("Task title (required)"),
	dueDate: z.string().optional().describe("Due date/time (ISO 8601 format)"),
	status: taskStatusSchema
		.optional()
		.default("todo")
		.describe("Initial status: todo, doing, ai_review, or done"),
	priority: taskPrioritySchema
		.optional()
		.default("medium")
		.describe("Priority level: low, medium, or high"),
	content: z.string().optional().describe("Task content/description"),
	grade: z.number().optional().describe("Grade/score for this task"),
});

export const deleteTaskInputSchema = z.object({
	taskId: z.string().describe("The unique identifier of the task to delete"),
	reason: z.string().optional().describe("Optional reason for deletion"),
});

export const updateTaskInputSchema = z.object({
	taskId: z.string().describe("The unique identifier of the task to update"),
	title: z.string().optional().describe("New title"),
	dueDate: z.string().optional().describe("New due date (ISO 8601)"),
	status: taskStatusSchema.optional().describe("New status"),
	priority: taskPrioritySchema.optional().describe("New priority"),
	content: z.string().optional().describe("New content/description"),
	grade: z.number().optional().describe("New grade/score"),
});

// ============================================
// TOOL FACTORY
// ============================================

/**
 * Create task tools with injected dependencies
 * This factory allows us to pass userId and repositories at runtime
 */
export function createTaskTools(deps: ToolDependencies) {
	const { userId, taskRepository } = deps;

	/**
	 * List Tasks - Automatic execution
	 * Returns paginated list without content field
	 */
	const listTasks = tool({
		description: listTasksMeta.description,
		inputSchema: listTasksInputSchema,
		execute: async (params) => {
			try {
				const result = await taskRepository.findAll(userId, {
					subjectId: params.subjectId,
					status: params.status,
					priority: params.priority,
					search: params.search,
					dueDateFrom: params.dueDateFrom,
					dueDateTo: params.dueDateTo,
					limit: params.limit,
					offset: params.offset,
					sortBy: params.sortBy,
					sortOrder: params.sortOrder,
				});

				return successResult({
					tasks: result.data,
					total: result.total,
					limit: params.limit,
					offset: params.offset,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to list tasks";
				return errorResult(message);
			}
		},
	});

	/**
	 * Get Task - Automatic execution
	 * Returns full task details including content
	 */
	const getTask = tool({
		description: getTaskMeta.description,
		inputSchema: getTaskInputSchema,
		execute: async ({ taskId }) => {
			try {
				const taskData = await taskRepository.findByIdAndUserId(userId, taskId);

				if (!taskData) {
					return errorResult(`Task with ID ${taskId} not found`);
				}

				return successResult(taskData);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to get task";
				return errorResult(message);
			}
		},
	});

	/**
	 * Create Task - Automatic execution
	 */
	const createTask = tool({
		description: createTaskMeta.description,
		inputSchema: createTaskInputSchema,
		execute: async (params) => {
			try {
				const newTask = await taskRepository.create(userId, {
					subjectId: params.subjectId,
					title: params.title,
					dueDate: params.dueDate,
					status: params.status,
					priority: params.priority,
					content: params.content,
					grade: params.grade,
				});

				return successResult({
					message: "Task created successfully",
					task: newTask,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to create task";
				return errorResult(message);
			}
		},
	});

	/**
	 * Delete Task - HITL (requires confirmation)
	 * NO execute function = pauses for user approval
	 */
	const deleteTask = tool({
		description: `${deleteTaskMeta.description} WARNING: This action is irreversible.`,
		inputSchema: deleteTaskInputSchema,
		// NO execute function - this triggers HITL flow
		// The client will receive this tool call and must approve/deny
		// Actual execution happens in executions.ts after approval
	});

	/**
	 * Update Task - HITL (requires confirmation)
	 * NO execute function = pauses for user approval
	 */
	const updateTask = tool({
		description: updateTaskMeta.description,
		inputSchema: updateTaskInputSchema,
		// NO execute function - this triggers HITL flow
		// Actual execution happens in executions.ts after approval
	});

	return {
		listTasks,
		getTask,
		createTask,
		deleteTask,
		updateTask,
	};
}

// ============================================
// TYPE EXPORTS
// ============================================

export type TaskTools = ReturnType<typeof createTaskTools>;
