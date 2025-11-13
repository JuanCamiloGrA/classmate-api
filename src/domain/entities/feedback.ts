/**
 * Represents feedback submitted by a user in the system.
 * @interface Feedback
 */
export interface Feedback {
	/** Unique identifier */
	id: string;
	/** User ID (optional, for authenticated users) */
	userId: string | null;
	/** User email (optional, for unauthenticated users) */
	userEmail: string | null;
	/** Feedback message */
	message: string;
	/** Page context where feedback was submitted (optional) */
	pageContext: string | null;
	/** ISO 8601 timestamp of feedback creation */
	createdAt: string;
}

/**
 * Input data for creating new feedback.
 * Subset of Feedback interface used during creation flow.
 * @interface FeedbackData
 */
export interface FeedbackData {
	/** User ID (optional, for authenticated users) */
	userId: string | null;
	/** User email (optional, for unauthenticated users) */
	userEmail: string | null;
	/** Feedback message */
	message: string;
	/** Page context where feedback was submitted (optional) */
	pageContext: string | null;
}
