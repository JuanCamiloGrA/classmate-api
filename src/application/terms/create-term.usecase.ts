import type { Term, TermData } from "../../domain/entities/term";
import type { TermRepository } from "../../domain/repositories/term.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for creating a term.
 * @interface CreateTermInput
 */
export interface CreateTermInput {
	/** Term name */
	name: string;
	/** Display order */
	order: number;
}

/**
 * Use case for creating a new term for an authenticated user.
 *
 * @class CreateTermUseCase
 * @example
 * ```typescript
 * const useCase = new CreateTermUseCase(termRepository);
 * const term = await useCase.execute(userId, {
 *   name: 'Fall 2024',
 *   order: 1
 * });
 * ```
 */
export class CreateTermUseCase {
	/**
	 * @param termRepository - Repository for term persistence
	 */
	constructor(private termRepository: TermRepository) {}

	/**
	 * Execute term creation.
	 * @param userId - The authenticated user ID
	 * @param input - Term creation input
	 * @returns Created term with system fields
	 * @throws ValidationError if input is invalid
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, input: CreateTermInput): Promise<Term> {
		// Validate input
		if (!input.name || input.name.trim().length === 0) {
			throw new ValidationError("Name is required");
		}

		if (typeof input.order !== "number" || !Number.isInteger(input.order)) {
			throw new ValidationError("Order must be an integer");
		}

		if (input.order < 0) {
			throw new ValidationError("Order must be non-negative");
		}

		const termData: TermData = {
			name: input.name,
			order: input.order,
		};

		return this.termRepository.create(userId, termData);
	}
}
