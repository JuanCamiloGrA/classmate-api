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
import { ProcessAudioSchema } from "../validators/class.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ClassContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const ProcessAudioResponseSchema = z.object({
	workflow_instance_id: z.string(),
	status: z.literal("accepted"),
});

const SuccessProcessAudioResponse = z.object({
	success: z.literal(true),
	result: ProcessAudioResponseSchema,
});

async function processAudio(c: ClassContext) {
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
		const validationResult = ProcessAudioSchema.safeParse(body);
		if (!validationResult.success) {
			throw new ValidationError(
				validationResult.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { r2_key, file_name, mime_type } = validationResult.data;

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

		// 5. Trigger the workflow
		const workflowInstance = await c.env.SUMMARIZE_CLASS_WORKFLOW.create({
			params: {
				classId,
				userId: auth.userId,
				input: {
					r2Key: r2_key,
					mimeType: mime_type,
					filename: file_name,
				},
			},
		});

		console.log("🚀 [PROCESS_AUDIO] Workflow triggered", {
			classId,
			userId: auth.userId,
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

export class ProcessClassAudioEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Process audio file for class summary",
		description:
			"Triggers an asynchronous workflow to process an uploaded audio/text file and generate a class summary. Returns immediately with a workflow instance ID that can be used to track progress.",
		request: {
			params: z.object({
				classId: z.string().min(1, "Class ID is required"),
			}),
			body: contentJson(ProcessAudioSchema),
		},
		responses: {
			"202": {
				description:
					"Processing request accepted, workflow started successfully",
				...contentJson(SuccessProcessAudioResponse),
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
		return processAudio(c);
	}
}
