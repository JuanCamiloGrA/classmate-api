/**
 * Summary Repository Interface (Port)
 * Defines contract for persisting class summaries
 */
export interface SummaryRepository {
	/**
	 * Save generated summary for a class
	 */
	save(classId: string, userId: string, summaryHtml: string): Promise<void>;
}
