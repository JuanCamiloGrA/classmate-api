import type { Term, TermData, TermUpdateData } from "../entities/term";

/**
 * Repository interface for term persistence operations.
 * Defines the contract for term data access.
 * Implementations must handle D1 database operations.
 * @interface TermRepository
 */
export interface TermRepository {
	/**
	 * List all non-deleted terms for a user.
	 * @param userId - The user ID to fetch terms for
	 * @returns Array of non-deleted terms ordered by order field
	 */
	findByUserId(userId: string): Promise<Term[]>;

	/**
	 * Retrieve a single term by ID for a specific user.
	 * @param userId - The user ID (ownership check)
	 * @param termId - The term ID to search for
	 * @returns The term if found and belongs to user, null otherwise
	 */
	findByIdAndUserId(userId: string, termId: string): Promise<Term | null>;

	/**
	 * Create a new term in the database.
	 * @param userId - The user ID who owns this term
	 * @param data - Term data to persist
	 * @returns The created term with system fields (id, timestamps)
	 */
	create(userId: string, data: TermData): Promise<Term>;

	/**
	 * Update an existing term.
	 * @param userId - The user ID (ownership check)
	 * @param termId - The term ID to update
	 * @param data - Partial term data to update
	 * @returns The updated term
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	update(userId: string, termId: string, data: TermUpdateData): Promise<Term>;

	/**
	 * Soft delete a term (marks as deleted, preserves data).
	 * Also soft deletes all related subjects.
	 * @param userId - The user ID (ownership check)
	 * @param termId - The term ID to soft delete
	 * @returns The deleted term with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	softDelete(userId: string, termId: string): Promise<Term>;

	/**
	 * Hard delete a term (permanently removes data).
	 * Cascades to related subjects and their resources.
	 * @param userId - The user ID (ownership check)
	 * @param termId - The term ID to permanently delete
	 * @returns The deleted term
	 * @throws NotFoundError if term not found or doesn't belong to user
	 */
	hardDelete(userId: string, termId: string): Promise<Term>;
}
