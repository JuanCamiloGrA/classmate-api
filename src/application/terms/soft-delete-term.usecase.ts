import type { Term } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";

/**
 * Use case for soft deleting a term (cascades to subjects).
 * Marks the term and all related subjects as deleted without removing data.
 * Only the user who owns the term can delete it.
 *
 * @class SoftDeleteTermUseCase
 * @example
 * ```typescript
 * const useCase = new SoftDeleteTermUseCase(termRepository);
 * const term = await useCase.execute(userId, termId);
 * ```
 */
export class SoftDeleteTermUseCase {
	/**
	 * @param termRepository - Repository for term persistence
	 */
	constructor(private termRepository: TermRepository) {}

	/**
	 * Execute soft deletion.
	 * Marks term and cascaded subjects as deleted, preserving data.
	 * @param userId - The authenticated user ID
	 * @param termId - The term ID to soft delete
	 * @returns The soft deleted term with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	async execute(userId: string, termId: string): Promise<Term> {
		return this.termRepository.softDelete(userId, termId);
	}
}
