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
	/** Professor name */
	professor: string | null;
	/** Credit hours */
	credits: number | null;
	/** Location */
	location: string | null;
	/** Schedule text */
	scheduleText: string | null;
	/** Syllabus URL */
	syllabusUrl: string | null;
	/** Color theme */
	colorTheme: string | null;
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
 * Lightweight class item for subject detail response.
 * Excludes heavy fields like content, summary, and transcription.
 * @interface SubjectClassItem
 */
export interface SubjectClassItem {
	/** Unique identifier */
	id: string;
	/** Class title */
	title: string | null;
	/** Start date */
	startDate: string | null;
	/** End date */
	endDate: string | null;
	/** Class link */
	link: string | null;
	/** Meeting link */
	meetingLink: string | null;
	/** Lifecycle status */
	status: string;
	/** AI processing status */
	aiStatus: string;
	/** Topics covered */
	topics: string | null;
	/** Duration in seconds */
	durationSeconds: number;
	/** Physical room location */
	roomLocation: string | null;
	/** Processing flag */
	isProcessed: number;
	/** Creation timestamp */
	createdAt: string;
	/** Update timestamp */
	updatedAt: string;
}

/**
 * Subject with paginated classes for detail endpoint.
 * @interface SubjectWithClasses
 */
export interface SubjectWithClasses extends Subject {
	/** Paginated list of classes */
	classes: SubjectClassItem[];
	/** Pagination metadata */
	pagination: {
		/** Total number of classes */
		total: number;
		/** Current page */
		page: number;
		/** Items per page */
		limit: number;
		/** Total pages */
		totalPages: number;
	};
}
