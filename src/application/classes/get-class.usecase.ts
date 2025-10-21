import type { ClassWithResources } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for retrieving a single class by ID with all details.
 * Includes associated resources (files).
 *
 * @class GetClassUseCase
 */
export class GetClassUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute class retrieval.
	 * @param userId - The authenticated user ID
	 * @param classId - The class ID to retrieve
	 * @returns The class with resources if found, null if not found or unauthorized
	 */
	async execute(
		userId: string,
		classId: string,
	): Promise<ClassWithResources | null> {
		return this.classRepository.findByIdAndUserId(userId, classId);
	}
}
