import type { Subject } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";

/**
 * Use case for soft deleting a subject and cascading to related entities.
 *
 * @class SoftDeleteSubjectUseCase
 * @example
 * ```typescript
 * const useCase = new SoftDeleteSubjectUseCase(subjectRepository);
 * const subject = await useCase.execute(userId, subjectId);
 * ```
 */
export class SoftDeleteSubjectUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 */
	constructor(private subjectRepository: SubjectRepository) {}

	/**
	 * Execute subject soft deletion with cascade.
	 * Marks the subject as deleted and cascades to tasks and classes.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to soft delete
	 * @returns The soft-deleted subject with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, subjectId: string): Promise<Subject> {
		return this.subjectRepository.softDelete(userId, subjectId);
	}
}
