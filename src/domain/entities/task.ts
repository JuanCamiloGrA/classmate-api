/**
 * Task status enumeration
 * - 'todo': Task not started
 * - 'doing': Task in progress
 * - 'done': Task completed
 */
export type TaskStatus = "todo" | "doing" | "done";

/**
 * Represents an academic task/assignment in the system.
 * @interface Task
 */
export interface Task {
	/** Unique identifier */
	id: string;
	/** User ID who owns this task */
	userId: string;
	/** Subject ID this task belongs to */
	subjectId: string;
	/** Task title (e.g., "Math Homework Chapter 5") */
	title: string;
	/** Due date stored as ISO 8601 string */
	dueDate: string | null;
	/** Task status */
	status: TaskStatus;
	/** Long-form content/description of the task (e.g., editor content) */
	content: string | null;
	/** Grade/score for this task (allows decimals e.g., 8.5) */
	grade: number | null;
	/** Soft delete flag (1 = deleted, 0 = active) */
	isDeleted: number;
	/** ISO 8601 timestamp of soft deletion, null if not deleted */
	deletedAt: string | null;
	/** ISO 8601 timestamp of task creation */
	createdAt: string;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

/**
 * Input data for creating a new task.
 * Subset of Task interface used during creation flow.
 * @interface TaskData
 */
export interface TaskData {
	/** Task title */
	title: string;
	/** Subject ID */
	subjectId: string;
	/** Due date (ISO 8601 string) */
	dueDate?: string | null;
	/** Task status */
	status?: TaskStatus;
	/** Task content/description */
	content?: string | null;
	/** Grade/score */
	grade?: number | null;
}

/**
 * Input data for updating a task.
 * All fields are optional.
 * @interface TaskUpdateData
 */
export interface TaskUpdateData {
	/** Task title (optional) */
	title?: string;
	/** Due date (optional) */
	dueDate?: string | null;
	/** Task status (optional) */
	status?: TaskStatus;
	/** Task content (optional) */
	content?: string | null;
	/** Grade/score (optional) */
	grade?: number | null;
}

/**
 * File resource associated with a task
 * @interface TaskResource
 */
export interface TaskResource {
	/** File ID */
	id: string;
	/** Original filename */
	originalFilename: string;
	/** MIME type */
	mimeType: string;
	/** File size in bytes */
	sizeBytes: number;
	/** Association type (e.g., 'resource', 'embedded_content') */
	associationType: string;
}

/**
 * Task with associated resources (files)
 * @interface TaskWithResources
 */
export interface TaskWithResources extends Task {
	/** Associated files */
	resources: TaskResource[];
}

/**
 * Optimized Task for list response
 * @interface TaskListItem
 */
export interface TaskListItem {
	/** Unique identifier */
	id: string;
	/** Subject ID */
	subjectId: string;
	/** Task title */
	title: string;
	/** Due date */
	dueDate: string | null;
	/** Task status */
	status: TaskStatus;
	/** Grade/score */
	grade: number | null;
	/** Creation timestamp */
	createdAt: string;
	/** Update timestamp */
	updatedAt: string;
}
