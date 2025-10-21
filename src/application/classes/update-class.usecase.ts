import type { Class, ClassUpdateData } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for updating an existing class.
 *
 * @class UpdateClassUseCase
 */
export class UpdateClassUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute class update.
	 * @param userId - The authenticated user ID
	 * @param classId - The class ID to update
	 * @param data - Partial class data to update
	 * @returns The updated class
	 * @throws NotFoundError if class not found or unauthorized
	 */
	async execute(
		userId: string,
		classId: string,
		data: ClassUpdateData,
	): Promise<Class> {
		return this.classRepository.update(userId, classId, data);
	}
}
