import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateScribeProjectUseCase } from "../../../application/scribe/create-scribe-project.usecase";
import { GetScribeProjectUseCase } from "../../../application/scribe/get-scribe-project.usecase";
import { ListScribeProjectsUseCase } from "../../../application/scribe/list-scribe-projects.usecase";
import { UpdateScribeProjectUseCase } from "../../../application/scribe/update-scribe-project.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { validateEnv } from "../../../config/env";
import {
	isSupportedRubricMimeType,
	SUPPORTED_RUBRIC_MIME_TYPES,
} from "../../../domain/services/scribe/agents";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ScribeProjectRepository } from "../../../infrastructure/database/repositories/d1-scribe-project.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
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
	/** Text content of the rubric (alternative to file upload) */
	rubricContent: z.string().optional(),
	/** URL of the rubric file in R2 (after upload via presigned URL) */
	rubricFileUrl: z.string().optional(),
	/** MIME type of the rubric file */
	rubricMimeType: z.string().optional(),
});

const GenerateRubricUploadUrlSchema = z.object({
	/** Original filename for the rubric */
	fileName: z.string().min(1, "File name is required"),
	/** MIME type of the file (must be PDF, image, or text) */
	contentType: z.enum(SUPPORTED_RUBRIC_MIME_TYPES, {
		errorMap: () => ({
			message: `Unsupported file type. Allowed: ${SUPPORTED_RUBRIC_MIME_TYPES.join(", ")}`,
		}),
	}),
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
	rubricFileUrl: z.string().nullable(),
	rubricMimeType: z.string().nullable(),
	formQuestions: z.unknown().nullable(),
	userAnswers: z.unknown().nullable(),
	reviewFeedback: z.unknown().nullable(),
	finalPdfUrl: z.string().nullable(),
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

			const { rubricContent, rubricFileUrl, rubricMimeType } = validation.data;

			// Validate that at least rubricContent or rubricFileUrl is provided
			if (!rubricContent && !rubricFileUrl) {
				throw new ValidationError(
					"Either rubricContent (text) or rubricFileUrl (file) must be provided",
				);
			}

			// Validate MIME type if file URL is provided
			if (rubricFileUrl && rubricMimeType) {
				if (!isSupportedRubricMimeType(rubricMimeType)) {
					throw new ValidationError(
						`Unsupported rubric file type: ${rubricMimeType}. Allowed: ${SUPPORTED_RUBRIC_MIME_TYPES.join(", ")}`,
					);
				}
			}

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new CreateScribeProjectUseCase(repo);

			const project = await useCase.execute({
				userId: auth.userId,
				title: validation.data.title,
				taskId: validation.data.taskId,
				subjectId: validation.data.subjectId,
				rubricContent: rubricContent ?? null,
				rubricFileUrl: rubricFileUrl ?? null,
				rubricMimeType: rubricMimeType ?? null,
			});

			// Trigger Workflow to start Architect
			await c.env.GENERATE_SCRIBE_PROJECT_WORKFLOW.create({
				params: {
					projectId: project.id,
					userId: auth.userId,
					action: "start",
				},
			});

			// Exclude internal fields from response
			const {
				contentMarkdown: _internal,
				currentLatex: _latex,
				finalPdfFileId: _pdfKey,
				...publicProject
			} = project;

			return c.json(publicProject, 201);
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

			// Exclude internal fields from each project
			const publicProjects = projects.map(
				({
					contentMarkdown: _internal,
					currentLatex: _latex,
					finalPdfFileId: _pdfKey,
					...rest
				}) => rest,
			);

			return c.json({ projects: publicProjects }, 200);
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

			// Exclude internal fields from response
			const {
				contentMarkdown: _internal,
				currentLatex: _latex,
				finalPdfFileId: _pdfKey,
				...publicProject
			} = project;

			return c.json(publicProject, 200);
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

			// Handle answer accumulation for revision rounds
			const updateData = { ...validation.data };

			if (validation.data.userAnswers) {
				// Fetch current project to check for existing answers
				const currentProject = await repo.findById(auth.userId, id);
				if (!currentProject) throw new NotFoundError("Project not found");

				const existingAnswers = currentProject.userAnswers as Record<
					string,
					unknown
				> | null;
				const newAnswers = validation.data.userAnswers as Record<
					string,
					unknown
				>;

				// Accumulate answers based on the current structure
				updateData.userAnswers = this.accumulateAnswers(
					existingAnswers,
					newAnswers,
				);
			}

			// Update logic
			const project = await useCase.execute(auth.userId, id, updateData);

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

			// Exclude internal fields from response
			const {
				contentMarkdown: _internal,
				currentLatex: _latex,
				finalPdfFileId: _pdfKey,
				...publicProject
			} = project;

			return c.json(publicProject, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}

	/**
	 * Accumulates user answers across revision rounds.
	 * First round: stores as _initialAnswers
	 * Subsequent rounds: appends to _revisionAnswers array
	 */
	private accumulateAnswers(
		existingAnswers: Record<string, unknown> | null,
		newAnswers: Record<string, unknown>,
	): Record<string, unknown> {
		// No existing answers - this is the first round (from Architect form)
		if (!existingAnswers) {
			return newAnswers;
		}

		// Check if already in structured format
		if (existingAnswers._initialAnswers !== undefined) {
			// This is a revision round - append new answers
			const revisionAnswers =
				(existingAnswers._revisionAnswers as unknown[]) || [];
			return {
				_initialAnswers: existingAnswers._initialAnswers,
				_revisionAnswers: [...revisionAnswers, newAnswers],
			};
		}

		// Existing answers are in flat format but we have previous markdown
		// This means supervisor rejected and we're getting revision answers
		// The handler already converted to structured format, so merge here
		return {
			_initialAnswers: existingAnswers,
			_revisionAnswers: [newAnswers],
		};
	}
}

// Response schemas for upload URL endpoint
const GenerateUploadUrlResponseSchema = z.object({
	signedUrl: z.string().url(),
	key: z.string(),
	publicUrl: z.string().url(),
});

/**
 * Generate Presigned Upload URL for Scribe Rubric
 *
 * The client should:
 * 1. Call this endpoint to get a presigned URL
 * 2. Upload the file directly to R2 using the presigned URL
 * 3. Use the returned `publicUrl` as `rubricFileUrl` when creating the project
 */
export class GenerateScribeRubricUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Generate presigned upload URL for rubric file",
		description:
			"Generate a presigned URL to upload a rubric file (PDF, image, or text) directly to R2 storage. Use the returned publicUrl as rubricFileUrl when creating the project.",
		request: {
			body: contentJson(GenerateRubricUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned URL generated successfully",
				...contentJson(GenerateUploadUrlResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const body = await c.req.json();
			const validation = GenerateRubricUploadUrlSchema.safeParse(body);
			if (!validation.success) {
				throw new ValidationError(
					validation.error.errors
						.map((e) => `${e.path.join(".")}: ${e.message}`)
						.join("; "),
				);
			}

			const { fileName, contentType } = validation.data;

			// Resolve R2 persistent bucket secrets (rubrics are permanent files)
			const endpoint = await resolveSecretBinding(
				c.env.R2_S3_PERSISTENT_API_ENDPOINT,
				"R2_S3_PERSISTENT_API_ENDPOINT",
			);
			const accessKeyId = await resolveSecretBinding(
				c.env.R2_PERSISTENT_ACCESS_KEY_ID,
				"R2_PERSISTENT_ACCESS_KEY_ID",
			);
			const secretAccessKey = await resolveSecretBinding(
				c.env.R2_PERSISTENT_SECRET_ACCESS_KEY,
				"R2_PERSISTENT_SECRET_ACCESS_KEY",
			);
			const bucketName = await resolveSecretBinding(
				c.env.R2_PERSISTENT_BUCKET_NAME,
				"R2_PERSISTENT_BUCKET_NAME",
			);

			const env = validateEnv({
				ENVIRONMENT: c.env.ENVIRONMENT,
				R2_PRESIGNED_URL_EXPIRATION_SECONDS:
					c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
			});

			const storageAdapter = new R2StorageAdapter({
				endpoint,
				accessKeyId,
				secretAccessKey,
			});

			// Generate unique key for the rubric file
			const timestamp = Date.now();
			const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
			const key = `scribe/rubrics/${auth.userId}/${timestamp}-${sanitizedFileName}`;

			// Generate presigned URL for upload
			const signedUrl = await storageAdapter.generatePresignedPutUrl(
				bucketName,
				key,
				contentType,
				env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
			);

			// Generate presigned URL for reading (after upload)
			// Use 7 days expiration for read access
			const publicUrl = await storageAdapter.generatePresignedGetUrl(
				bucketName,
				key,
				7 * 24 * 60 * 60,
			);

			return c.json(
				{
					signedUrl,
					key,
					publicUrl,
				},
				200,
			);
		} catch (e) {
			return handleError(e, c);
		}
	}
}
