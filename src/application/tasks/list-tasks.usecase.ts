import type {
	TaskFilters,
	TaskListResult,
	TaskRepository,
} from "../../domain/repositories/task.repository";

/**
 * Use case for listing tasks with advanced filtering, sorting and pagination.
 *
 * @class ListTasksUseCase
 * @example
 * ```typescript
 * const useCase = new ListTasksUseCase(taskRepository);
 * const result = await useCase.execute(userId, { status: ['todo'], limit: 10 });
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
	 * @param filters - Filter options
	 * @returns Object containing data array and total count
	 */
	async execute(userId: string, filters: TaskFilters): Promise<TaskListResult> {
		return this.taskRepository.findAll(userId, filters);
	}
}
