import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateFeedbackUseCase } from "../../../application/feedback/create-feedback.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1FeedbackRepository } from "../../../infrastructure/database/repositories/feedback.repository";
import { handleError, ValidationError } from "../middleware/error-handler";
import {
	type CreateFeedbackInput,
	CreateFeedbackSchema,
} from "../validators/feedback.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type FeedbackContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const FeedbackSchema = z.object({
	id: z.string(),
	message: z.string(),
	userEmail: z.string().nullable(),
	userId: z.string().nullable(),
	pageContext: z.string().nullable(),
	createdAt: z.string(),
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: FeedbackSchema,
});

function getFeedbackRepository(c: FeedbackContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1FeedbackRepository(db);
}

function validateCreatePayload(body: unknown): CreateFeedbackInput {
	const result = CreateFeedbackSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.issues
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data as CreateFeedbackInput;
}

async function createFeedback(c: FeedbackContext) {
	try {
		const payload = validateCreatePayload(await c.req.json());
		const feedbackRepository = getFeedbackRepository(c);
		const useCase = new CreateFeedbackUseCase(feedbackRepository);
		const feedback = await useCase.execute(payload);

		return c.json(
			{
				success: true,
				result: {
					id: feedback.id,
					message: feedback.message,
					userEmail: feedback.userEmail,
					userId: feedback.userId,
					pageContext: feedback.pageContext,
					createdAt: feedback.createdAt,
				},
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class CreateFeedbackEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Feedback"],
		summary: "Create feedback",
		description:
			"Submit feedback about the application. No authentication required. Feedback is useful for improving the platform.",
		request: {
			body: contentJson(CreateFeedbackSchema),
		},
		responses: {
			"201": {
				description: "Feedback created successfully",
				...contentJson(SuccessCreateResponse),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: FeedbackContext) {
		return createFeedback(c);
	}
}
