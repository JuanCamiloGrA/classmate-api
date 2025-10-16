import type { Term } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";

/**
 * Use case for listing all terms for an authenticated user.
 * Returns only non-deleted terms ordered by the order field.
 *
 * @class ListTermsUseCase
 * @example
 * ```typescript
 * const useCase = new ListTermsUseCase(termRepository);
 * const terms = await useCase.execute(userId);
 * ```
 */
export class ListTermsUseCase {
	/**
	 * @param termRepository - Repository for term persistence
	 */
	constructor(private termRepository: TermRepository) {}

	/**
	 * Execute terms listing.
	 * @param userId - The authenticated user ID
	 * @returns Array of non-deleted terms ordered by order field
	 */
	async execute(userId: string): Promise<Term[]> {
		return this.termRepository.findByUserId(userId);
	}
}
