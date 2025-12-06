import type { ClassAIStatus } from "../entities/class";

/**
 * Summary Repository Interface (Port)
 * Defines contract for persisting class summaries
 */
export interface SummaryRepository {
	/**
	 * Save generated summary for a class
	 */
	save(classId: string, userId: string, summaryHtml: string): Promise<void>;

	/**
	 * Update AI processing status for a class
	 */
	updateAIStatus(
		classId: string,
		userId: string,
		status: ClassAIStatus,
	): Promise<void>;
}
