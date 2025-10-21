/**
 * Represents an academic class session/lecture in the system.
 * @interface Class
 */
export interface Class {
	/** Unique identifier */
	id: string;
	/** User ID who owns this class */
	userId: string;
	/** Subject ID this class belongs to */
	subjectId: string;
	/** Class title (e.g., "Chapter 5 Introduction") */
	title: string | null;
	/** Start date stored as ISO 8601 string */
	startDate: string | null;
	/** End date stored as ISO 8601 string */
	endDate: string | null;
	/** Class link (e.g., meeting URL or recording link) */
	link: string | null;
	/** Class content/transcription/notes */
	content: string | null;
	/** AI-generated summary of the class */
	summary: string | null;
	/** Soft delete flag (1 = deleted, 0 = active) */
	isDeleted: number;
	/** ISO 8601 timestamp of soft deletion, null if not deleted */
	deletedAt: string | null;
	/** ISO 8601 timestamp of class creation */
	createdAt: string;
	/** ISO 8601 timestamp of last update */
	updatedAt: string;
}

/**
 * Input data for creating a new class.
 * Subset of Class interface used during creation flow.
 * @interface ClassData
 */
export interface ClassData {
	/** Subject ID */
	subjectId: string;
	/** Class title */
	title?: string | null;
	/** Start date (ISO 8601 string) */
	startDate?: string | null;
	/** End date (ISO 8601 string) */
	endDate?: string | null;
	/** Class link */
	link?: string | null;
	/** Class content */
	content?: string | null;
	/** AI-generated summary */
	summary?: string | null;
}

/**
 * Input data for updating a class.
 * All fields are optional.
 * @interface ClassUpdateData
 */
export interface ClassUpdateData {
	/** Class title (optional) */
	title?: string | null;
	/** Start date (optional) */
	startDate?: string | null;
	/** End date (optional) */
	endDate?: string | null;
	/** Class link (optional) */
	link?: string | null;
	/** Class content (optional) */
	content?: string | null;
	/** AI-generated summary (optional) */
	summary?: string | null;
}

/**
 * File resource associated with a class
 * @interface ClassResource
 */
export interface ClassResource {
	/** File ID */
	id: string;
	/** Original filename */
	originalFilename: string;
	/** MIME type */
	mimeType: string;
	/** File size in bytes */
	sizeBytes: number;
	/** Association type (e.g., 'resource', 'embedded_content') */
	associationType: string;
}

/**
 * Class with associated resources (files)
 * @interface ClassWithResources
 */
export interface ClassWithResources extends Class {
	/** Associated files */
	resources: ClassResource[];
}

/**
 * Optimized Class for list response
 * @interface ClassListItem
 */
export interface ClassListItem {
	/** Unique identifier */
	id: string;
	/** Subject ID */
	subjectId: string;
	/** Class title */
	title: string | null;
	/** Start date */
	startDate: string | null;
	/** End date */
	endDate: string | null;
	/** Class link */
	link: string | null;
	/** Creation timestamp */
	createdAt: string;
	/** Update timestamp */
	updatedAt: string;
}
