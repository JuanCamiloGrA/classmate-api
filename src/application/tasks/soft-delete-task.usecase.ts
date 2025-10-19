import type { Task } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";

/**
 * Use case for soft deleting a task (marks as deleted, preserves data).
 *
 * @class SoftDeleteTaskUseCase
 * @example
 * ```typescript
 * const useCase = new SoftDeleteTaskUseCase(taskRepository);
 * const task = await useCase.execute(userId, taskId);
 * ```
 */
export class SoftDeleteTaskUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute soft delete operation.
	 * @param userId - The authenticated user ID
	 * @param taskId - The task ID to soft delete
	 * @returns The soft-deleted task with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	async execute(userId: string, taskId: string): Promise<Task> {
		return this.taskRepository.softDelete(userId, taskId);
	}
}
