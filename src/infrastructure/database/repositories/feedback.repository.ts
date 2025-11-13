import type { Feedback, FeedbackData } from "../../../domain/entities/feedback";
import type { FeedbackRepository } from "../../../domain/repositories/feedback.repository";
import type { Database } from "../client";
import { feedback } from "../schema";

/**
 * D1 implementation of the FeedbackRepository interface.
 * Handles all feedback persistence operations using Drizzle ORM.
 * @class D1FeedbackRepository
 */
export class D1FeedbackRepository implements FeedbackRepository {
	constructor(private db: Database) {}

	async create(data: FeedbackData): Promise<Feedback> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newFeedback = await this.db
			.insert(feedback)
			.values({
				id,
				userId: data.userId,
				userEmail: data.userEmail,
				message: data.message,
				pageContext: data.pageContext,
				createdAt: now,
			})
			.returning()
			.get();

		if (!newFeedback) {
			throw new Error("Failed to create feedback");
		}

		return newFeedback;
	}
}
