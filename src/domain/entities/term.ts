/**
 * Represents an academic term in the system.
 * @interface Term
 */
export interface Term {
	/** Unique identifier */
	id: string;
	/** User ID who owns this term */
	userId: string;
	/** Term name (e.g., "Fall 2024") */
	name: string;
	/** Display order for the term */
	order: number;
	/** Soft delete flag (1 = deleted, 0 = active) */
	isDeleted: number;
	/** ISO 8601 timestamp of soft deletion, null if not deleted */
	deletedAt: string | null;
	/** ISO 8601 timestamp of term creation */
	createdAt: string;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

/**
 * Input data for creating a new term.
 * Subset of Term interface used during creation flow.
 * @interface TermData
 */
export interface TermData {
	/** Term name */
	name: string;
	/** Display order */
	order: number;
}

/**
 * Input data for updating a term.
 * All fields are optional.
 * @interface TermUpdateData
 */
export interface TermUpdateData {
	/** Term name (optional) */
	name?: string;
	/** Display order (optional) */
	order?: number;
}
