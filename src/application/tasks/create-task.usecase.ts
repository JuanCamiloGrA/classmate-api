import type { Task, TaskData } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for creating a task.
 * @interface CreateTaskInput
 */
export interface CreateTaskInput {
	/** Task title */
	title: string;
	/** Subject ID */
	subjectId: string;
	/** Due date (ISO 8601 string) */
	dueDate?: string | null;
	/** Task status */
	status?: "todo" | "doing" | "done";
	/** Task content/description */
	content?: string | null;
	/** Grade/score */
	grade?: number | null;
}

/**
 * Use case for creating a new task for an authenticated user.
 *
 * @class CreateTaskUseCase
 * @example
 * ```typescript
 * const useCase = new CreateTaskUseCase(taskRepository);
 * const task = await useCase.execute(userId, {
 *   title: 'Math Homework',
 *   subjectId: 'subject-123',
 *   dueDate: '2024-10-25T23:59:59Z'
 * });
 * ```
 */
export class CreateTaskUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute task creation.
	 * @param userId - The authenticated user ID
	 * @param input - Task creation input
	 * @returns Created task with system fields
	 * @throws ValidationError if input is invalid
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, input: CreateTaskInput): Promise<Task> {
		// Validate input
		if (!input.title || input.title.trim().length === 0) {
			throw new ValidationError("Title is required");
		}

		if (!input.subjectId || input.subjectId.trim().length === 0) {
			throw new ValidationError("Subject ID is required");
		}

		// Validate status if provided
		if (input.status && !["todo", "doing", "done"].includes(input.status)) {
			throw new ValidationError(
				"Invalid status. Must be 'todo', 'doing', or 'done'",
			);
		}

		// Validate grade if provided
		if (input.grade !== undefined && input.grade !== null) {
			if (typeof input.grade !== "number") {
				throw new ValidationError("Grade must be a number");
			}
			if (input.grade < 0) {
				throw new ValidationError("Grade cannot be negative");
			}
		}

		const taskData: TaskData = {
			title: input.title.trim(),
			subjectId: input.subjectId,
			dueDate: input.dueDate ?? null,
			status: input.status ?? "todo",
			content: input.content ?? null,
			grade: input.grade ?? null,
		};

		return this.taskRepository.create(userId, taskData);
	}
}
