import { eq, sql } from "drizzle-orm";
import type { SummaryRepository } from "../../../domain/repositories/summary.repository";
import type { Database } from "../client";
import { classes } from "../schema";

/**
 * D1 Summary Repository
 * Implements SummaryRepository using Drizzle ORM with D1
 */
export class D1SummaryRepository implements SummaryRepository {
	constructor(private readonly db: Database) {}

	async save(
		classId: string,
		_userId: string,
		summaryHtml: string,
	): Promise<void> {
		try {
			console.log("💾 [SUMMARY_REPO] Saving summary", { classId });

			await this.db
				.update(classes)
				.set({
					summary: summaryHtml,
					updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
				})
				.where(eq(classes.id, classId))
				.execute();

			console.log("✅ [SUMMARY_REPO] Summary saved successfully", { classId });
		} catch (error) {
			console.error("❌ [SUMMARY_REPO] Failed to save summary", {
				classId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}
}
