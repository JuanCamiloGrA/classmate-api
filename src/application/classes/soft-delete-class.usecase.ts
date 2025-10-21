import type { Class } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for soft deleting a class (marks as deleted without removing data).
 *
 * @class SoftDeleteClassUseCase
 */
export class SoftDeleteClassUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute soft delete.
	 * @param userId - The authenticated user ID
	 * @param classId - The class ID to soft delete
	 * @returns The soft-deleted class with updated metadata
	 * @throws NotFoundError if class not found or unauthorized
	 */
	async execute(userId: string, classId: string): Promise<Class> {
		return this.classRepository.softDelete(userId, classId);
	}
}
