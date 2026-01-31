import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import {
	ClassNotAccessibleError,
	GenerateClassAudioUploadUrlUseCase,
} from "../../../application/classes/generate-class-audio-upload-url.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { validateEnv } from "../../../config/env";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ClassRepository } from "../../../infrastructure/database/repositories/class.repository";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { D1StorageAccountingRepository } from "../../../infrastructure/database/repositories/storage-accounting.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	handleError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import { GenerateUploadUrlSchema } from "../validators/class.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ClassContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const GenerateUploadUrlResponseSchema = z.object({
	signed_url: z.string().url(),
	key: z.string(),
});

const SuccessGenerateUploadUrlResponse = z.object({
	success: z.literal(true),
	result: GenerateUploadUrlResponseSchema,
});

async function generateUploadUrl(c: ClassContext) {
	try {
		const auth = getAuth(c);
		if (!auth?.userId) {
			throw new UnauthorizedError();
		}

		const classId = c.req.param("classId");
		if (!classId) {
			throw new ValidationError("Class ID is required");
		}

		const body = await c.req.json();
		const validationResult = GenerateUploadUrlSchema.safeParse(body);
		if (!validationResult.success) {
			throw new ValidationError(
				validationResult.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { file_name, content_type, size_bytes } = validationResult.data;

		const db = DatabaseFactory.create(c.env.DB);
		const classRepository = new D1ClassRepository(db);
		const libraryRepository = new D1LibraryRepository(db);
		const storageAccountingRepository = new D1StorageAccountingRepository(db);

		const endpoint = await resolveSecretBinding(
			c.env.R2_S3_API_ENDPOINT,
			"R2_S3_API_ENDPOINT",
		);
		const accessKeyId = await resolveSecretBinding(
			c.env.R2_ACCESS_KEY_ID,
			"R2_ACCESS_KEY_ID",
		);
		const secretAccessKey = await resolveSecretBinding(
			c.env.R2_SECRET_ACCESS_KEY,
			"R2_SECRET_ACCESS_KEY",
		);
		const bucketName = await resolveSecretBinding(
			c.env.R2_TEMPORAL_BUCKET_NAME,
			"R2_TEMPORAL_BUCKET_NAME",
		);

		const storageRepository = new R2StorageAdapter({
			endpoint,
			accessKeyId,
			secretAccessKey,
		});

		const env = validateEnv({
			ENVIRONMENT: c.env.ENVIRONMENT,
			R2_PRESIGNED_URL_EXPIRATION_SECONDS:
				c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
		});

		const useCase = new GenerateClassAudioUploadUrlUseCase(
			classRepository,
			libraryRepository,
			storageAccountingRepository,
			storageRepository,
			{
				bucket: bucketName,
				expiresInSeconds: env.R2_PRESIGNED_URL_EXPIRATION_SECONDS,
			},
		);

		const result = await useCase.execute({
			userId: auth.userId,
			classId,
			fileName: file_name,
			contentType: content_type,
			sizeBytes: size_bytes,
		});

		return c.json(
			{
				success: true,
				result: {
					signed_url: result.signedUrl,
					key: result.key,
				},
			},
			200,
		);
	} catch (error) {
		if (error instanceof ClassNotAccessibleError) {
			return handleError(new NotFoundError(error.message), c);
		}
		return handleError(error, c);
	}
}

export class GenerateClassAudioUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Generate presigned upload URL for class audio",
		description:
			"Generate a presigned URL to upload an audio file directly to R2 storage for a specific class. The URL expires after a configured duration (default 300 seconds).",
		request: {
			params: z.object({
				classId: z.string().min(1, "Class ID is required"),
			}),
			body: contentJson(GenerateUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned URL generated successfully",
				...contentJson(SuccessGenerateUploadUrlResponse),
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
		return generateUploadUrl(c);
	}
}
