import type { ClassListItem } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for listing all classes for a specific subject.
 * Returns optimized class list with only essential fields.
 *
 * @class ListClassesUseCase
 */
export class ListClassesUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute class listing.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to list classes for
	 * @returns Array of non-deleted classes (optimized fields)
	 */
	async execute(userId: string, subjectId: string): Promise<ClassListItem[]> {
		return this.classRepository.findBySubjectIdAndUserId(userId, subjectId);
	}
}
