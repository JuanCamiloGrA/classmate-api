import type { Task } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";

/**
 * Use case for hard deleting a task (permanently removes data).
 * Cascades to related task resources via foreign key constraints.
 *
 * @class HardDeleteTaskUseCase
 * @example
 * ```typescript
 * const useCase = new HardDeleteTaskUseCase(taskRepository);
 * const task = await useCase.execute(userId, taskId);
 * ```
 */
export class HardDeleteTaskUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute hard delete operation.
	 * @param userId - The authenticated user ID
	 * @param taskId - The task ID to permanently delete
	 * @returns The deleted task
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	async execute(userId: string, taskId: string): Promise<Task> {
		return this.taskRepository.hardDelete(userId, taskId);
	}
}
