import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateScribeProjectUseCase } from "../../../application/scribe/create-scribe-project.usecase";
import { GetScribeProjectUseCase } from "../../../application/scribe/get-scribe-project.usecase";
import { ListScribeProjectsUseCase } from "../../../application/scribe/list-scribe-projects.usecase";
import { UpdateScribeProjectUseCase } from "../../../application/scribe/update-scribe-project.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ScribeProjectRepository } from "../../../infrastructure/database/repositories/d1-scribe-project.repository";
import {
	handleError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ScribeContext = Context<HonoContext>;

// Schemas
const CreateScribeProjectSchema = z.object({
	title: z.string().optional(),
	taskId: z.string().optional(),
	subjectId: z.string().optional(),
	rubricContent: z.string().optional(),
});

const UpdateScribeProjectSchema = z.object({
	title: z.string().optional(),
	userAnswers: z.record(z.unknown()).optional(),
	rubricContent: z.string().optional(),
	status: z
		.enum([
			"draft",
			"collecting_answers",
			"drafting",
			"reviewing",
			"needs_input",
			"typesetting",
			"completed",
			"failed",
		])
		.optional(),
	reviewFeedback: z.unknown().optional(),
});

const ScribeProjectResponseSchema = z.object({
	id: z.string(),
	userId: z.string(),
	title: z.string(),
	status: z.string(),
	rubricContent: z.string().nullable(),
	formQuestions: z.unknown().nullable(),
	userAnswers: z.unknown().nullable(),
	contentMarkdown: z.string().nullable(),
	currentLatex: z.string().nullable(),
	reviewFeedback: z.unknown().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const ScribeProjectListResponseSchema = z.object({
	projects: z.array(ScribeProjectResponseSchema),
});

// Endpoints

export class CreateScribeProjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Create a new Scribe project",
		request: {
			body: contentJson(CreateScribeProjectSchema),
		},
		responses: {
			"201": {
				description: "Project created",
				...contentJson(ScribeProjectResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const body = await c.req.json();
			const validation = CreateScribeProjectSchema.safeParse(body);
			if (!validation.success) throw new ValidationError("Invalid input");

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new CreateScribeProjectUseCase(repo);

			const project = await useCase.execute({
				userId: auth.userId,
				...validation.data,
			});

			// Trigger Workflow to start Architect
			await c.env.GENERATE_SCRIBE_PROJECT_WORKFLOW.create({
				params: {
					projectId: project.id,
					userId: auth.userId,
					action: "start",
				},
			});

			return c.json(project, 201);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class ListScribeProjectsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "List all Scribe projects",
		responses: {
			"200": {
				description: "List of projects",
				...contentJson(ScribeProjectListResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new ListScribeProjectsUseCase(repo);

			const projects = await useCase.execute(auth.userId);

			return c.json({ projects }, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class GetScribeProjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Get a Scribe project",
		request: {
			params: z.object({
				id: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Project details",
				...contentJson(ScribeProjectResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const id = c.req.param("id");
			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new GetScribeProjectUseCase(repo);

			const project = await useCase.execute(auth.userId, id);
			if (!project) throw new NotFoundError("Project not found");

			return c.json(project, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class UpdateScribeProjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Update a Scribe project",
		request: {
			params: z.object({
				id: z.string(),
			}),
			body: contentJson(UpdateScribeProjectSchema),
		},
		responses: {
			"200": {
				description: "Updated project",
				...contentJson(ScribeProjectResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const id = c.req.param("id");
			const body = await c.req.json();
			const validation = UpdateScribeProjectSchema.safeParse(body);
			if (!validation.success) throw new ValidationError("Invalid input");

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new UpdateScribeProjectUseCase(repo);

			// Update logic
			const project = await useCase.execute(auth.userId, id, validation.data);

			// If user answers provided, trigger workflow to continue
			if (validation.data.userAnswers) {
				await c.env.GENERATE_SCRIBE_PROJECT_WORKFLOW.create({
					params: {
						projectId: project.id,
						userId: auth.userId,
						action: "continue",
					},
				});
			} else if (validation.data.reviewFeedback) {
				// If review feedback provided (approved or rejected), trigger workflow
				await c.env.GENERATE_SCRIBE_PROJECT_WORKFLOW.create({
					params: {
						projectId: project.id,
						userId: auth.userId,
						action: "continue",
					},
				});
			}

			return c.json(project, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}
