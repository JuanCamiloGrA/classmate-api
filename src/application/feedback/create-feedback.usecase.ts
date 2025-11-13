import type { Feedback, FeedbackData } from "../../domain/entities/feedback";
import type { FeedbackRepository } from "../../domain/repositories/feedback.repository";
import { ValidationError } from "../../interfaces/http/middleware/error-handler";

/**
 * Input data for creating feedback.
 * @interface CreateFeedbackInput
 */
export interface CreateFeedbackInput {
	/** Feedback message */
	message: string;
	/** User email (optional) */
	userEmail?: string;
	/** User ID (optional) */
	userId?: string;
	/** Page context (optional) */
	pageContext?: string;
}

/**
 * Use case for creating new feedback.
 *
 * @class CreateFeedbackUseCase
 * @example
 * ```typescript
 * const useCase = new CreateFeedbackUseCase(feedbackRepository);
 * const feedback = await useCase.execute({
 *   message: 'Great feature!',
 *   userEmail: 'user@example.com',
 *   pageContext: '/dashboard'
 * });
 * ```
 */
export class CreateFeedbackUseCase {
	/**
	 * @param feedbackRepository - Repository for feedback persistence
	 */
	constructor(private feedbackRepository: FeedbackRepository) {}

	/**
	 * Execute feedback creation.
	 * @param input - Feedback creation input
	 * @returns Created feedback with system fields
	 * @throws ValidationError if input is invalid
	 * @throws Database errors from repository layer
	 */
	async execute(input: CreateFeedbackInput): Promise<Feedback> {
		// Validate input
		if (!input.message || input.message.trim().length === 0) {
			throw new ValidationError("Message is required");
		}

		const feedbackData: FeedbackData = {
			message: input.message.trim(),
			userEmail: input.userEmail ?? null,
			userId: input.userId ?? null,
			pageContext: input.pageContext ?? null,
		};

		return this.feedbackRepository.create(feedbackData);
	}
}
