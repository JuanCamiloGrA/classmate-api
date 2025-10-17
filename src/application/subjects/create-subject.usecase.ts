import type { Subject, SubjectData } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for creating a subject.
 * @interface CreateSubjectInput
 */
export interface CreateSubjectInput {
	/** Subject name */
	name: string;
	/** Term ID */
	termId: string;
}

/**
 * Use case for creating a new subject for an authenticated user.
 *
 * @class CreateSubjectUseCase
 * @example
 * ```typescript
 * const useCase = new CreateSubjectUseCase(subjectRepository);
 * const subject = await useCase.execute(userId, {
 *   name: 'Mathematics',
 *   termId: 'term-123'
 * });
 * ```
 */
export class CreateSubjectUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 */
	constructor(private subjectRepository: SubjectRepository) {}

	/**
	 * Execute subject creation.
	 * @param userId - The authenticated user ID
	 * @param input - Subject creation input
	 * @returns Created subject with system fields
	 * @throws ValidationError if input is invalid
	 * @throws Database errors from repository layer
	 */
	async execute(userId: string, input: CreateSubjectInput): Promise<Subject> {
		// Validate input
		if (!input.name || input.name.trim().length === 0) {
			throw new ValidationError("Name is required");
		}

		if (!input.termId || input.termId.trim().length === 0) {
			throw new ValidationError("Term ID is required");
		}

		const subjectData: SubjectData = {
			name: input.name,
			termId: input.termId,
		};

		return this.subjectRepository.create(userId, subjectData);
	}
}
