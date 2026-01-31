import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ClassRepository } from "../../../infrastructure/database/repositories/class.repository";
import {
	handleError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import { ProcessUrlSchema } from "../validators/class.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ClassContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const ProcessUrlResponseSchema = z.object({
	workflow_instance_id: z.string(),
	status: z.literal("accepted"),
});

const SuccessProcessUrlResponse = z.object({
	success: z.literal(true),
	result: ProcessUrlResponseSchema,
});

async function processUrl(c: ClassContext) {
	try {
		// 1. Authenticate user
		const auth = getAuth(c);
		if (!auth?.userId) {
			throw new UnauthorizedError();
		}

		// 2. Extract and validate classId from path
		const classId = c.req.param("classId");
		if (!classId) {
			throw new ValidationError("Class ID is required");
		}

		// 3. Validate request body
		const body = await c.req.json();
		const validationResult = ProcessUrlSchema.safeParse(body);
		if (!validationResult.success) {
			throw new ValidationError(
				validationResult.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { source_url } = validationResult.data;

		// 4. Verify user owns the class
		const db = DatabaseFactory.create(c.env.DB);
		const classRepository = new D1ClassRepository(db);
		const classItem = await classRepository.findByIdAndUserId(
			auth.userId,
			classId,
		);

		if (!classItem) {
			throw new NotFoundError("Class not found or you don't have access to it");
		}

		// 5. Trigger the workflow with URL input
		const workflowInstance = await c.env.SUMMARIZE_CLASS_WORKFLOW.create({
			params: {
				classId,
				userId: auth.userId,
				input: {
					sourceUrl: source_url,
				},
			},
		});

		console.log("🚀 [PROCESS_URL] Workflow triggered", {
			classId,
			userId: auth.userId,
			sourceUrl: source_url,
			workflowInstanceId: workflowInstance.id,
		});

		// 6. Return 202 Accepted with workflow instance ID
		return c.json(
			{
				success: true,
				result: {
					workflow_instance_id: workflowInstance.id,
					status: "accepted" as const,
				},
			},
			202,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class ProcessClassUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Process class from URL",
		description:
			"Triggers an asynchronous workflow to process a class from an external URL. The Heavy API downloads the file, extracts audio if needed, uploads to R2, and generates a summary. Returns immediately with a workflow instance ID that can be used to track progress.",
		request: {
			params: z.object({
				classId: z.string().min(1, "Class ID is required"),
			}),
			body: contentJson(ProcessUrlSchema),
		},
		responses: {
			"202": {
				description:
					"Processing request accepted, workflow started successfully",
				...contentJson(SuccessProcessUrlResponse),
			},
			"400": {
				description: "Invalid request parameters or body",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Class not found or access denied",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ClassContext) {
		return processUrl(c);
	}
}
