import { z } from "zod";

/**
 * Input data for creating a task.
 */
export interface CreateTaskInput {
	title: string;
	subjectId: string;
	dueDate?: string | null;
	status?: "todo" | "doing" | "done";
	content?: string | null;
	grade?: number | null;
}

/**
 * Input data for updating a task (all optional).
 */
export interface UpdateTaskInput {
	title?: string;
	dueDate?: string | null;
	status?: "todo" | "doing" | "done";
	content?: string | null;
	grade?: number | null;
}

/**
 * Validation schema for creating a new task.
 * - title: required, non-empty string
 * - subjectId: required, non-empty string (UUID)
 * - dueDate: optional, ISO 8601 string
 * - status: optional, must be 'todo', 'doing', or 'done'
 * - content: optional, string
 * - grade: optional, number >= 0
 */
export const CreateTaskSchema = z.object({
	title: z.string().min(1, "Title is required"),
	subject_id: z.string().min(1, "Subject ID is required"),
	due_date: z.string().datetime().nullable().optional(),
	status: z.enum(["todo", "doing", "done"]).optional(),
	content: z.string().nullable().optional(),
	grade: z.number().min(0, "Grade cannot be negative").nullable().optional(),
});

/**
 * Validation schema for updating a task.
 * All fields are optional, but at least one must be provided.
 */
export const UpdateTaskSchema = z
	.object({
		title: z.string().min(1, "Title is required").optional(),
		due_date: z.string().datetime().nullable().optional(),
		status: z.enum(["todo", "doing", "done"]).optional(),
		content: z.string().nullable().optional(),
		grade: z.number().min(0, "Grade cannot be negative").nullable().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});

/**
 * Validation schema for listing tasks by subject.
 * - subject_id: required, non-empty string (UUID) - snake_case for query parameters
 */
export const ListTasksBySubjectSchema = z.object({
	subject_id: z.string().min(1, "Subject ID is required"),
});
