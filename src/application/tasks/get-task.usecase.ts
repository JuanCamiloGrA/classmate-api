import type { TaskWithResources } from "../../domain/entities/task";
import type { TaskRepository } from "../../domain/repositories/task.repository";
import { NotFoundError } from "../../interfaces/http/middleware/error-handler";

/**
 * Use case for retrieving a single task with all details and associated files.
 *
 * @class GetTaskUseCase
 * @example
 * ```typescript
 * const useCase = new GetTaskUseCase(taskRepository);
 * const task = await useCase.execute(userId, taskId);
 * ```
 */
export class GetTaskUseCase {
	/**
	 * @param taskRepository - Repository for task persistence
	 */
	constructor(private taskRepository: TaskRepository) {}

	/**
	 * Execute task retrieval.
	 * @param userId - The authenticated user ID
	 * @param taskId - The task ID to retrieve
	 * @returns Task with all details and resources
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	async execute(userId: string, taskId: string): Promise<TaskWithResources> {
		const task = await this.taskRepository.findByIdAndUserId(userId, taskId);

		if (!task) {
			throw new NotFoundError("Task not found");
		}

		return task;
	}
}
