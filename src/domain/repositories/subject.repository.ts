import type {
	Subject,
	SubjectData,
	SubjectUpdateData,
} from "../entities/subject";

/**
 * Repository interface for subject persistence operations.
 * Defines the contract for subject data access.
 * Implementations must handle D1 database operations.
 * @interface SubjectRepository
 */
export interface SubjectRepository {
	/**
	 * List all non-deleted subjects for a term.
	 * @param userId - The user ID (ownership check)
	 * @param termId - The term ID to fetch subjects for
	 * @returns Array of non-deleted subjects
	 */
	findByTermIdAndUserId(userId: string, termId: string): Promise<Subject[]>;

	/**
	 * Retrieve a single subject by ID for a specific user.
	 * @param userId - The user ID (ownership check)
	 * @param subjectId - The subject ID to search for
	 * @returns The subject if found and belongs to user, null otherwise
	 */
	findByIdAndUserId(userId: string, subjectId: string): Promise<Subject | null>;

	/**
	 * Create a new subject in the database.
	 * @param userId - The user ID who owns this subject
	 * @param data - Subject data to persist
	 * @returns The created subject with system fields (id, timestamps)
	 */
	create(userId: string, data: SubjectData): Promise<Subject>;

	/**
	 * Update an existing subject.
	 * @param userId - The user ID (ownership check)
	 * @param subjectId - The subject ID to update
	 * @param data - Partial subject data to update
	 * @returns The updated subject
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 */
	update(
		userId: string,
		subjectId: string,
		data: SubjectUpdateData,
	): Promise<Subject>;

	/**
	 * Soft delete a subject (marks as deleted, preserves data).
	 * Also soft deletes all related tasks and classes in cascade.
	 * @param userId - The user ID (ownership check)
	 * @param subjectId - The subject ID to soft delete
	 * @returns The deleted subject with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 */
	softDelete(userId: string, subjectId: string): Promise<Subject>;

	/**
	 * Hard delete a subject (permanently removes data).
	 * Cascades to related tasks and classes via foreign key constraints.
	 * @param userId - The user ID (ownership check)
	 * @param subjectId - The subject ID to permanently delete
	 * @returns The deleted subject
	 * @throws NotFoundError if subject not found or doesn't belong to user
	 */
	hardDelete(userId: string, subjectId: string): Promise<Subject>;
}
