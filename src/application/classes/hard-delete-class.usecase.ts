import type { Class } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for hard deleting a class (permanently removes data and cascades to related resources).
 *
 * @class HardDeleteClassUseCase
 */
export class HardDeleteClassUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute hard delete.
	 * @param userId - The authenticated user ID
	 * @param classId - The class ID to permanently delete
	 * @returns The deleted class (for reference)
	 * @throws NotFoundError if class not found or unauthorized
	 */
	async execute(userId: string, classId: string): Promise<Class> {
		return this.classRepository.hardDelete(userId, classId);
	}
}
