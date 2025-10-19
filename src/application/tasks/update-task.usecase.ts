import type { Task, TaskUpdateData } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for updating a task (all optional).
 * @interface UpdateTaskInput
 */
export interface UpdateTaskInput {
	/** Task title (optional) */
	title?: string;
	/** Due date (optional) */
	dueDate?: string | null;
	/** Task status (optional) */
	status?: "todo" | "doing" | "done";
	/** Task content (optional) */
	content?: string | null;
	/** Grade/score (optional) */
	grade?: number | null;
}

/**
 * Use case for updating an existing task.
 *
 * @class UpdateTaskUseCase
 * @example
 * ```typescript
 * const useCase = new UpdateTaskUseCase(taskRepository);
 * const task = await useCase.execute(userId, taskId, {
 *   status: 'done',
 *   grade: 9.5
 * });
 * ```
 */
export class UpdateTaskUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute task update.
	 * @param userId - The authenticated user ID
	 * @param taskId - The task ID to update
	 * @param input - Partial task update input
	 * @returns Updated task
	 * @throws ValidationError if input is invalid or no fields provided
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	async execute(
		userId: string,
		taskId: string,
		input: UpdateTaskInput,
	): Promise<Task> {
		// Validate that at least one field is provided
		if (Object.keys(input).length === 0) {
			throw new ValidationError(
				"At least one field must be provided for update",
			);
		}

		// Validate title if provided
		if (input.title !== undefined) {
			if (input.title !== null && input.title.trim().length === 0) {
				throw new ValidationError("Title cannot be empty");
			}
		}

		// Validate status if provided
		if (input.status !== undefined) {
			if (!["todo", "doing", "done"].includes(input.status)) {
				throw new ValidationError(
					"Invalid status. Must be 'todo', 'doing', or 'done'",
				);
			}
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

		const taskData: TaskUpdateData = {};
		if (input.title !== undefined) {
			taskData.title = input.title;
		}
		if (input.dueDate !== undefined) {
			taskData.dueDate = input.dueDate;
		}
		if (input.status !== undefined) {
			taskData.status = input.status;
		}
		if (input.content !== undefined) {
			taskData.content = input.content;
		}
		if (input.grade !== undefined) {
			taskData.grade = input.grade;
		}

		return this.taskRepository.update(userId, taskId, taskData);
	}
}
