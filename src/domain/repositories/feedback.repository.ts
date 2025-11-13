import type { Feedback, FeedbackData } from "../entities/feedback";

/**
 * Repository interface for feedback persistence operations.
 * Defines the contract for feedback data access.
 * Implementations must handle D1 database operations.
 * @interface FeedbackRepository
 */
export interface FeedbackRepository {
	/**
	 * Create new feedback in the database.
	 * @param data - Feedback data to persist
	 * @returns The created feedback with system fields (id, createdAt)
	 */
	create(data: FeedbackData): Promise<Feedback>;
}
