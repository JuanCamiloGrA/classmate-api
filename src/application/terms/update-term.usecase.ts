import type { Term, TermUpdateData } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";

/**
 * Input data for updating a term.
 * All fields are optional.
 * @interface UpdateTermInput
 */
export interface UpdateTermInput {
	/** Term name (optional) */
	name?: string;
	/** Display order (optional) */
	order?: number;
}

/**
 * Use case for updating an existing term.
 * Only the user who owns the term can update it.
 *
 * @class UpdateTermUseCase
 * @example
 * ```typescript
 * const useCase = new UpdateTermUseCase(termRepository);
 * const term = await useCase.execute(userId, termId, {
 *   name: 'Fall 2024 - Updated'
 * });
 * ```
 */
export class UpdateTermUseCase {
	/**
	 * @param termRepository - Repository for term persistence
	 */
	constructor(private termRepository: TermRepository) {}

	/**
	 * Execute term update.
	 * @param userId - The authenticated user ID
	 * @param termId - The term ID to update
	 * @param input - Partial term update data
	 * @returns Updated term
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	async execute(
		userId: string,
		termId: string,
		input: UpdateTermInput,
	): Promise<Term> {
		const updateData: TermUpdateData = {};

		if (input.name !== undefined) {
			updateData.name = input.name;
		}

		if (input.order !== undefined) {
			updateData.order = input.order;
		}

		// Ensure at least one field is provided
		if (Object.keys(updateData).length === 0) {
			throw new Error("No fields provided to update");
		}

		return this.termRepository.update(userId, termId, updateData);
	}
}
