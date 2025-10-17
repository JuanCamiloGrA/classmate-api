/**
 * Represents an academic subject in the system.
 * @interface Subject
 */
export interface Subject {
	/** Unique identifier */
	id: string;
	/** User ID who owns this subject */
	userId: string;
	/** Term ID this subject belongs to */
	termId: string;
	/** Subject name (e.g., "Mathematics") */
	name: string;
	/** Soft delete flag (1 = deleted, 0 = active) */
	isDeleted: number;
	/** ISO 8601 timestamp of soft deletion, null if not deleted */
	deletedAt: string | null;
	/** ISO 8601 timestamp of subject creation */
	createdAt: string;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

/**
 * Input data for creating a new subject.
 * Subset of Subject interface used during creation flow.
 * @interface SubjectData
 */
export interface SubjectData {
	/** Subject name */
	name: string;
	/** Term ID */
	termId: string;
}

/**
 * Input data for updating a subject.
 * All fields are optional.
 * @interface SubjectUpdateData
 */
export interface SubjectUpdateData {
	/** Subject name (optional) */
	name?: string;
}
