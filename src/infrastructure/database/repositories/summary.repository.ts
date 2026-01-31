import { and, eq, sql } from "drizzle-orm";
import type { ClassAIStatus } from "../../../domain/entities/class";
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
		userId: string,
		summaryMarkdown: string,
	): Promise<void> {
		try {
			console.log("💾 [SUMMARY_REPO] Saving summary", { classId });

			await this.db
				.update(classes)
				.set({
					summary: summaryMarkdown,
					updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
				})
				.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
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

	async updateAIStatus(
		classId: string,
		userId: string,
		status: ClassAIStatus,
	): Promise<void> {
		try {
			console.log("🔄 [SUMMARY_REPO] Updating ai_status", {
				classId,
				status,
			});

			await this.db
				.update(classes)
				.set({
					aiStatus: status,
					updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
				})
				.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
				.execute();

			console.log("✅ [SUMMARY_REPO] ai_status updated", { classId, status });
		} catch (error) {
			console.error("❌ [SUMMARY_REPO] Failed to update ai_status", {
				classId,
				status,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}
}
