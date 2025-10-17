import type { Subject } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";

/**
 * Use case for hard deleting a subject and cascading via foreign keys.
 *
 * @class HardDeleteSubjectUseCase
 * @example
 * ```typescript
 * const useCase = new HardDeleteSubjectUseCase(subjectRepository);
 * const subject = await useCase.execute(userId, subjectId);
 * ```
 */
export class HardDeleteSubjectUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 */
	constructor(private subjectRepository: SubjectRepository) {}

	/**
	 * Execute subject hard deletion with automatic cascade via foreign keys.
	 * Permanently removes the subject and related tasks/classes.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to hard delete
	 * @returns The deleted subject
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, subjectId: string): Promise<Subject> {
		return this.subjectRepository.hardDelete(userId, subjectId);
	}
}
