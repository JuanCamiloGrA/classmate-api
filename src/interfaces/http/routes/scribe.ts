import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateScribeProjectUseCase } from "../../../application/scribe/create-scribe-project.usecase";
import {
	GenerateScribeAnswerUploadUrlUseCase,
	ScribeProjectNotAccessibleError,
} from "../../../application/scribe/generate-scribe-answer-upload-url.usecase";
import { GetScribeProjectUseCase } from "../../../application/scribe/get-scribe-project.usecase";
import { ListScribeProjectsUseCase } from "../../../application/scribe/list-scribe-projects.usecase";
import { RunScribeIterationUseCase } from "../../../application/scribe/run-scribe-iteration.usecase";
import { UnlockScribePdfUseCase } from "../../../application/scribe/unlock-scribe-pdf.usecase";
import { UpdateScribeProjectUseCase } from "../../../application/scribe/update-scribe-project.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { validateEnv } from "../../../config/env";
import {
	buildUserR2Key,
	sanitizeFilename,
} from "../../../domain/services/r2-path.service";
import {
	isSupportedRubricMimeType,
	SUPPORTED_RUBRIC_MIME_TYPES,
} from "../../../domain/services/scribe/agents";
import { ScribeAIService } from "../../../infrastructure/ai/scribe.ai.service";
import { ScribeManifestService } from "../../../infrastructure/api/scribe-manifest.service";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ScribeProjectRepository } from "../../../infrastructure/database/repositories/d1-scribe-project.repository";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";
import { DevLogger } from "../../../infrastructure/logging/dev-logger";
import { ScribePdfService } from "../../../infrastructure/pdf/scribe-pdf.service";
import { AssetsPromptService } from "../../../infrastructure/prompt/assets.prompt.service";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	handleError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";

type HonoContext = { Bindings: Bindings; Variables: Variables };

type ScribeContext = Context<HonoContext>;

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

function ensureUserId(c: ScribeContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) throw new UnauthorizedError();
	return auth.userId;
}

async function createPersistentStorageAdapter(c: ScribeContext) {
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
	const bucket = await resolveSecretBinding(
		c.env.R2_PERSISTENT_BUCKET_NAME,
		"R2_PERSISTENT_BUCKET_NAME",
	);

	return {
		storage: new R2StorageAdapter({ endpoint, accessKeyId, secretAccessKey }),
		bucket,
	};
}

function mergeAnswerObjects(
	existing: unknown,
	incoming: Record<string, unknown>,
): Record<string, unknown> {
	if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
		return incoming;
	}
	return { ...(existing as Record<string, unknown>), ...incoming };
}

async function createIterationUseCase(c: ScribeContext) {
	const aiGatewayApiKey = await resolveSecretBinding(
		c.env.AI_GATEWAY_API_KEY,
		"AI_GATEWAY_API_KEY",
	);
	const scribeHeavyApiUrl = await resolveSecretBinding(
		c.env.SCRIBE_HEAVY_API_URL,
		"SCRIBE_HEAVY_API_URL",
	);
	const internalScribeApiKey = await resolveSecretBinding(
		c.env.INTERNAL_SCRIBE_API_KEY,
		"INTERNAL_SCRIBE_API_KEY",
	);

	const logger = new DevLogger(c.env.ENVIRONMENT);

	const { storage, bucket } = await createPersistentStorageAdapter(c);
	const promptService = new AssetsPromptService(c.env.ASSETS, logger);
	const scribeAIService = new ScribeAIService(
		aiGatewayApiKey,
		promptService,
		logger,
	);
	const pdfService = new ScribePdfService(
		scribeHeavyApiUrl,
		internalScribeApiKey,
		logger,
	);
	const manifestService = new ScribeManifestService(
		scribeHeavyApiUrl,
		internalScribeApiKey,
		logger,
	);

	const db = DatabaseFactory.create(c.env.DB);
	const scribeRepo = new D1ScribeProjectRepository(db);
	const profileRepo = new D1ProfileRepository(db);

	return {
		useCase: new RunScribeIterationUseCase(
			scribeAIService,
			scribeRepo,
			profileRepo,
			manifestService,
			pdfService,
			storage,
			{ bucket },
			logger,
		),
		scribeRepo,
		bucket,
		storage,
		logger,
	};
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const GenerateRubricUploadUrlSchema = z.object({
	fileName: z.string().min(1, "File name is required"),
	contentType: z.enum(SUPPORTED_RUBRIC_MIME_TYPES, {
		errorMap: () => ({
			message: `Unsupported file type. Allowed: ${SUPPORTED_RUBRIC_MIME_TYPES.join(", ")}`,
		}),
	}),
});

const GenerateRubricUploadUrlResponseSchema = z.object({
	signedUrl: z.string().url(),
	key: z.string(),
	publicUrl: z.string().url(),
});

const AnswerUploadMimeTypes = [
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

const GenerateScribeAnswerUploadUrlSchema = z.object({
	questionId: z.string().min(1),
	fileName: z.string().min(1),
	contentType: z.enum(AnswerUploadMimeTypes),
});

const GenerateScribeAnswerUploadUrlResponseSchema = z.object({
	signedUrl: z.string().url(),
	file_route: z.string().min(1),
});

const IterateScribeSchema = z.object({
	projectId: z.string().optional(),
	// Create-only fields (required when projectId is absent)
	title: z.string().optional(),
	taskId: z.string().optional(),
	subjectId: z.string().optional(),
	templateId: z.string().default("default"),
	rubricContent: z.string().optional(),
	rubricFileUrl: z.string().optional(),
	rubricMimeType: z.string().optional(),
	// Optional: answers from the latest form iteration
	userAnswers: z.record(z.unknown()).optional(),
});

const ScribeProjectResponseSchema = z.object({
	id: z.string(),
	userId: z.string(),
	templateId: z.string(),
	title: z.string(),
	status: z.string(),
	rubricContent: z.string().nullable(),
	rubricFileUrl: z.string().nullable(),
	rubricMimeType: z.string().nullable(),
	formSchema: z.unknown().nullable(),
	userAnswers: z.unknown().nullable(),
	exam: z.unknown().nullable(),
	finalPdfUrl: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const IterateScribeResponseSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("form"),
		projectId: z.string(),
		status: z.literal("needs_input"),
		form: z.unknown(),
	}),
	z.object({
		kind: z.literal("result"),
		projectId: z.string(),
		status: z.literal("blocked"),
		pdfUrl: z.string().url(),
		exam: z.unknown(),
	}),
]);

const UnlockPdfResponseSchema = z.object({ success: z.literal(true) });

const ScribeTemplateSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
});

const ListScribeTemplatesResponseSchema = z.object({
	templates: z.array(ScribeTemplateSchema),
});

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------

export class GenerateScribeRubricUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Generate presigned upload URL for rubric file",
		request: {
			body: contentJson(GenerateRubricUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned URL generated successfully",
				...contentJson(GenerateRubricUploadUrlResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);

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

			const { storage, bucket } = await createPersistentStorageAdapter(c);

			const env = validateEnv({
				ENVIRONMENT: c.env.ENVIRONMENT,
				R2_PRESIGNED_URL_EXPIRATION_SECONDS:
					c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
			});

			const key = buildUserR2Key({
				userId,
				category: "rubrics",
				filename: sanitizeFilename(fileName),
			});

			const signedUrl = await storage.generatePresignedPutUrl(
				bucket,
				key,
				contentType,
				env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
			);

			const publicUrl = await storage.generatePresignedGetUrl(
				bucket,
				key,
				7 * 24 * 60 * 60,
			);

			return c.json({ signedUrl, key, publicUrl }, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class GenerateScribeAnswerUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Generate presigned upload URL for a Scribe form answer image",
		request: {
			params: z.object({ id: z.string().min(1) }),
			body: contentJson(GenerateScribeAnswerUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned URL generated successfully",
				...contentJson(GenerateScribeAnswerUploadUrlResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);
			const projectId = c.req.param("id");

			const body = await c.req.json();
			const validation = GenerateScribeAnswerUploadUrlSchema.safeParse(body);
			if (!validation.success) throw new ValidationError("Invalid input");

			const { storage, bucket } = await createPersistentStorageAdapter(c);

			const expiresInSeconds = c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS
				? Number.parseInt(c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS, 10)
				: 3600;

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);

			const useCase = new GenerateScribeAnswerUploadUrlUseCase(repo, storage, {
				bucket,
				expiresInSeconds,
			});

			const result = await useCase.execute({
				userId,
				projectId,
				questionId: validation.data.questionId,
				fileName: validation.data.fileName,
				contentType: validation.data.contentType,
			});

			return c.json(result, 200);
		} catch (e) {
			if (e instanceof ScribeProjectNotAccessibleError) {
				return handleError(new NotFoundError(e.message), c);
			}
			return handleError(e, c);
		}
	}
}

export class IterateScribeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Run one Scribe iteration (returns form or PDF+exam)",
		request: {
			body: contentJson(IterateScribeSchema),
		},
		responses: {
			"200": {
				description: "Iteration result",
				...contentJson(IterateScribeResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);

			const body = await c.req.json();

			const { useCase, scribeRepo, logger } = await createIterationUseCase(c);

			logger.log("SCRIBE_ENDPOINT", "Client Request Payload", body);

			const parsed = IterateScribeSchema.safeParse(body);
			if (!parsed.success) throw new ValidationError("Invalid input");

			let projectId = parsed.data.projectId;

			if (!projectId) {
				const { rubricContent, rubricFileUrl, rubricMimeType } = parsed.data;
				if (!rubricContent && !rubricFileUrl) {
					throw new ValidationError(
						"Either rubricContent (text) or rubricFileUrl (file) must be provided",
					);
				}
				if (rubricFileUrl && rubricMimeType) {
					if (!isSupportedRubricMimeType(rubricMimeType)) {
						throw new ValidationError(
							`Unsupported rubric file type: ${rubricMimeType}. Allowed: ${SUPPORTED_RUBRIC_MIME_TYPES.join(", ")}`,
						);
					}
				}

				const createUseCase = new CreateScribeProjectUseCase(scribeRepo);
				const project = await createUseCase.execute({
					userId,
					title: parsed.data.title,
					taskId: parsed.data.taskId,
					subjectId: parsed.data.subjectId,
					templateId: parsed.data.templateId,
					rubricContent: rubricContent ?? null,
					rubricFileUrl: rubricFileUrl ?? null,
					rubricMimeType: rubricMimeType ?? null,
				});
				projectId = project.id;
			}

			// Update answers if provided
			if (parsed.data.userAnswers) {
				const current = await scribeRepo.findById(userId, projectId);
				if (!current) throw new NotFoundError("Project not found");
				const merged = mergeAnswerObjects(
					current.userAnswers,
					parsed.data.userAnswers,
				);
				const updateUseCase = new UpdateScribeProjectUseCase(scribeRepo);
				await updateUseCase.execute(userId, projectId, { userAnswers: merged });
			}

			const result = await useCase.execute({ userId, projectId });

			logger.log("SCRIBE_ENDPOINT", "Response Sent to Client", result);

			return c.json(result, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class ListScribeTemplatesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "List available Scribe templates",
		responses: {
			"200": {
				description: "Templates from Scribe Heavy API",
				...contentJson(ListScribeTemplatesResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			ensureUserId(c);

			const scribeHeavyApiUrl = await resolveSecretBinding(
				c.env.SCRIBE_HEAVY_API_URL,
				"SCRIBE_HEAVY_API_URL",
			);
			const internalScribeApiKey = await resolveSecretBinding(
				c.env.INTERNAL_SCRIBE_API_KEY,
				"INTERNAL_SCRIBE_API_KEY",
			);

			const url = `${scribeHeavyApiUrl}/v1/templates`;
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"X-API-KEY": internalScribeApiKey,
					Accept: "application/json",
				},
			});

			const contentType =
				response.headers.get("Content-Type") ?? "application/json";

			if (!response.ok) {
				const payload = await response.text();
				throw new Error(
					`Failed to fetch templates: ${response.status} - ${payload}`,
				);
			}

			if (!response.body) {
				const payload = await response.text();
				return c.body(payload, 200, {
					"Content-Type": contentType,
				});
			}

			return c.body(response.body, 200, {
				"Content-Type": contentType,
			});
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
				...contentJson(
					z.object({ projects: z.array(ScribeProjectResponseSchema) }),
				),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);
			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new ListScribeProjectsUseCase(repo);

			const projects = await useCase.execute(userId);

			const publicProjects = projects.map(
				({
					contentMarkdown: _contentMarkdown,
					currentTypstJson: _currentTypstJson,
					reviewFeedback: _reviewFeedback,
					finalPdfFileId: _finalPdfFileId,
					workflowId: _workflowId,
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
		request: { params: z.object({ id: z.string().min(1) }) },
		responses: {
			"200": {
				description: "Project details",
				...contentJson(ScribeProjectResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);
			const id = c.req.param("id");

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new GetScribeProjectUseCase(repo);

			const project = await useCase.execute(userId, id);
			if (!project) throw new NotFoundError("Project not found");

			const {
				contentMarkdown: _contentMarkdown,
				currentTypstJson: _currentTypstJson,
				reviewFeedback: _reviewFeedback,
				finalPdfFileId: _finalPdfFileId,
				workflowId: _workflowId,
				...publicProject
			} = project;

			return c.json(publicProject, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

export class UnlockScribePdfEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Scribe"],
		summary: "Unlock a Scribe PDF (blocked → available)",
		request: {
			params: z.object({ id: z.string().min(1) }),
		},
		responses: {
			"200": {
				description: "Unlocked",
				...contentJson(UnlockPdfResponseSchema),
			},
		},
	};

	async handle(c: ScribeContext) {
		try {
			const userId = ensureUserId(c);
			const projectId = c.req.param("id");

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ScribeProjectRepository(db);
			const useCase = new UnlockScribePdfUseCase(repo);
			await useCase.execute({ userId, projectId });

			return c.json({ success: true }, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}
