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
	/** Term ID (optional) */
	termId?: string;
	/** Professor name (optional) */
	professor?: string;
	/** Credit hours (optional) */
	credits?: number;
	/** Location (optional) */
	location?: string;
	/** Schedule text (optional) */
	scheduleText?: string;
	/** Syllabus URL (optional) */
	syllabusUrl?: string;
	/** Color theme (optional) */
	colorTheme?: string;
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
		const hasAtLeastOneField = Object.keys(input).length > 0;
		if (!hasAtLeastOneField) {
			throw new ValidationError(
				"At least one field must be provided for update",
			);
		}

		// Validate non-empty strings if provided
		if (input.name !== undefined && input.name.trim().length === 0) {
			throw new ValidationError("Name must be a non-empty string");
		}

		if (input.termId !== undefined && input.termId.trim().length === 0) {
			throw new ValidationError("Term ID must be a non-empty string");
		}

		if (
			input.colorTheme !== undefined &&
			input.colorTheme.trim().length === 0
		) {
			throw new ValidationError("Color theme must be a non-empty string");
		}

		// Build update data object
		const updateData: SubjectUpdateData = {};

		if (input.name !== undefined) {
			updateData.name = input.name;
		}

		if (input.termId !== undefined) {
			updateData.termId = input.termId;
		}

		if (input.professor !== undefined) {
			updateData.professor = input.professor;
		}

		if (input.credits !== undefined) {
			updateData.credits = input.credits;
		}

		if (input.location !== undefined) {
			updateData.location = input.location;
		}

		if (input.scheduleText !== undefined) {
			updateData.scheduleText = input.scheduleText;
		}

		if (input.syllabusUrl !== undefined) {
			updateData.syllabusUrl = input.syllabusUrl;
		}

		if (input.colorTheme !== undefined) {
			updateData.colorTheme = input.colorTheme;
		}

		return this.subjectRepository.update(userId, subjectId, updateData);
	}
}
