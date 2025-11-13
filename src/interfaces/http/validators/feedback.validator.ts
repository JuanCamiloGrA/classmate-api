import { z } from "zod";

/**
 * Input data for creating feedback.
 */
export interface CreateFeedbackInput {
	message: string;
	userEmail?: string;
	userId?: string;
	pageContext?: string;
}

/**
 * Validation schema for creating new feedback.
 * - message: required, non-empty string
 * - userEmail: optional, valid email string
 * - userId: optional, non-empty string
 * - pageContext: optional, non-empty string
 */
export const CreateFeedbackSchema = z
	.object({
		message: z
			.string()
			.min(1, "Message is required")
			.max(5000, "Message must not exceed 5000 characters"),
		userEmail: z
			.string()
			.email("Invalid email format")
			.optional()
			.or(z.literal("")),
		userId: z.string().min(1).optional().or(z.literal("")),
		pageContext: z.string().min(1).optional().or(z.literal("")),
	})
	.transform((data) => ({
		message: data.message,
		userEmail:
			data.userEmail && data.userEmail.length > 0 ? data.userEmail : undefined,
		userId: data.userId && data.userId.length > 0 ? data.userId : undefined,
		pageContext:
			data.pageContext && data.pageContext.length > 0
				? data.pageContext
				: undefined,
	}));
