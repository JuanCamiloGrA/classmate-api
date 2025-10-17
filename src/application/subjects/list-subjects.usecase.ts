import type { Subject } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";

/**
 * Use case for listing all subjects for a specific term.
 *
 * @class ListSubjectsUseCase
 * @example
 * ```typescript
 * const useCase = new ListSubjectsUseCase(subjectRepository);
 * const subjects = await useCase.execute(userId, termId);
 * ```
 */
export class ListSubjectsUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 */
	constructor(private subjectRepository: SubjectRepository) {}

	/**
	 * Execute subjects listing.
	 * @param userId - The authenticated user ID
	 * @param termId - The term ID to list subjects for
	 * @returns Array of non-deleted subjects for the term
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, termId: string): Promise<Subject[]> {
		return this.subjectRepository.findByTermIdAndUserId(userId, termId);
	}
}
