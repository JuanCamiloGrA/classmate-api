import type { Subject, SubjectUpdateData } from "../../domain/entities/subject";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for updating a subject.
 * @interface UpdateSubjectInput
 */
export interface UpdateSubjectInput {
	/** Subject name (optional) */
	name?: string;
}

/**
 * Use case for updating a subject for an authenticated user.
 *
 * @class UpdateSubjectUseCase
 * @example
 * ```typescript
 * const useCase = new UpdateSubjectUseCase(subjectRepository);
 * const subject = await useCase.execute(userId, subjectId, {
 *   name: 'Advanced Mathematics'
 * });
 * ```
 */
export class UpdateSubjectUseCase {
	/**
	 * @param subjectRepository - Repository for subject persistence
	 */
	constructor(private subjectRepository: SubjectRepository) {}

	/**
	 * Execute subject update.
	 * @param userId - The authenticated user ID
	 * @param subjectId - The subject ID to update
	 * @param input - Subject update input
	 * @returns Updated subject with system fields
	 * @throws ValidationError if input is invalid
	 * @throws NotFoundError if subject not found
	 * @throws Database errors from repository layer
	 */
	async execute(
		userId: string,
		subjectId: string,
		input: UpdateSubjectInput,
	): Promise<Subject> {
		// Validate that at least one field is provided
		if (!input.name) {
			throw new ValidationError(
				"At least one field must be provided for update",
			);
		}

		if (input.name && input.name.trim().length === 0) {
			throw new ValidationError("Name must be a non-empty string");
		}

		const updateData: SubjectUpdateData = {};

		if (input.name !== undefined) {
			updateData.name = input.name;
		}

		return this.subjectRepository.update(userId, subjectId, updateData);
	}
}
