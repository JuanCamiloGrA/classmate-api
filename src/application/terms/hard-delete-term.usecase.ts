import type { Term } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";

/**
 * Use case for hard deleting a term (permanent deletion with cascades).
 * Permanently removes the term and all related data.
 * Only the user who owns the term can delete it.
 *
 * ⚠️ WARNING: This operation is irreversible. All related subjects and their
 * resources (tasks, classes, files) will also be permanently deleted.
 *
 * @class HardDeleteTermUseCase
 * @example
 * ```typescript
 * const useCase = new HardDeleteTermUseCase(termRepository);
 * const term = await useCase.execute(userId, termId);
 * ```
 */
export class HardDeleteTermUseCase {
	/**
	 * @param termRepository - Repository for term persistence
	 */
	constructor(private termRepository: TermRepository) {}

	/**
	 * Execute hard deletion.
	 * Permanently removes term and cascaded data.
	 * @param userId - The authenticated user ID
	 * @param termId - The term ID to hard delete
	 * @returns The deleted term
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	async execute(userId: string, termId: string): Promise<Term> {
		return this.termRepository.hardDelete(userId, termId);
	}
}
