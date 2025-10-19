import type { TaskListItem } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";

/**
 * Use case for listing all tasks for a specific subject.
 * Returns optimized task list with only essential fields.
 *
 * @class ListTasksUseCase
 * @example
 * ```typescript
 * const useCase = new ListTasksUseCase(taskRepository);
 * const tasks = await useCase.execute(userId, subjectId);
 * ```
 */
export class ListTasksUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute task listing.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to list tasks for
	 * @returns Array of non-deleted tasks (optimized fields)
	 */
	async execute(userId: string, subjectId: string): Promise<TaskListItem[]> {
		return this.taskRepository.findBySubjectIdAndUserId(userId, subjectId);
	}
}
