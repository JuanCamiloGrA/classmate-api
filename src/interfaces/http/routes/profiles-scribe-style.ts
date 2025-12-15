import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { GenerateScribeStyleUploadUrlUseCase } from "../../../application/profiles/generate-scribe-style-upload-url.usecase";
import { UpdateScribeStyleSlotUseCase } from "../../../application/profiles/update-scribe-style-slot.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ProfileRepository } from "../../../infrastructure/database/repositories/profile.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";

type HonoContext = { Bindings: Bindings; Variables: Variables };

type ProfileContext = Context<HonoContext>;

function isValidUserR2KeyForRubrics(userId: string, key: string): boolean {
	// users/:userId/rubrics/:year/:month/:uuid-:filename
	const pattern = new RegExp(
		`^users/${userId}/rubrics/\\d{4}/\\d{2}/[a-f0-9-]+-[a-zA-Z0-9._-]+$`,
	);
	return pattern.test(key);
}

const AllowedStyleRefMimeTypes = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

const GenerateScribeStyleUploadUrlSchema = z.object({
	slot: z.union([z.literal(1), z.literal(2)]),
	fileName: z.string().min(1),
	contentType: z.enum(AllowedStyleRefMimeTypes),
});

const GenerateScribeStyleUploadUrlResponseSchema = z.object({
	signedUrl: z.string().url(),
	file_route: z.string().min(1),
});

export class GenerateProfileScribeStyleUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Profiles"],
		summary: "Generate presigned upload URL for Scribe style reference slot",
		request: {
			body: contentJson(GenerateScribeStyleUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned URL generated",
				...contentJson(GenerateScribeStyleUploadUrlResponseSchema),
			},
		},
	};

	async handle(c: ProfileContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const body = await c.req.json();
			const parsed = GenerateScribeStyleUploadUrlSchema.safeParse(body);
			if (!parsed.success) throw new ValidationError("Invalid input");

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

			const expiresInSeconds = c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS
				? Number.parseInt(c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS, 10)
				: 3600;

			const storageAdapter = new R2StorageAdapter({
				endpoint,
				accessKeyId,
				secretAccessKey,
			});

			const db = DatabaseFactory.create(c.env.DB);
			const profileRepo = new D1ProfileRepository(db);

			const useCase = new GenerateScribeStyleUploadUrlUseCase(
				profileRepo,
				storageAdapter,
				{
					bucket,
					expiresInSeconds,
				},
			);

			const result = await useCase.execute({
				userId: auth.userId,
				slot: parsed.data.slot,
				fileName: parsed.data.fileName,
				contentType: parsed.data.contentType,
			});

			return c.json(result, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}

const UpdateScribeStyleSlotSchema = z.object({
	slot: z.union([z.literal(1), z.literal(2)]),
	file_route: z.string().min(1),
	mimeType: z.string().min(1),
	originalFilename: z.string().min(1),
});

const UpdateScribeStyleSlotResponseSchema = z.object({
	success: z.literal(true),
});

export class UpdateProfileScribeStyleEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Profiles"],
		summary: "Persist Scribe style reference slot metadata",
		request: {
			body: contentJson(UpdateScribeStyleSlotSchema),
		},
		responses: {
			"200": {
				description: "Slot updated",
				...contentJson(UpdateScribeStyleSlotResponseSchema),
			},
		},
	};

	async handle(c: ProfileContext) {
		try {
			const auth = getAuth(c);
			if (!auth?.userId) throw new UnauthorizedError();

			const body = await c.req.json();
			const parsed = UpdateScribeStyleSlotSchema.safeParse(body);
			if (!parsed.success) throw new ValidationError("Invalid input");

			if (!isValidUserR2KeyForRubrics(auth.userId, parsed.data.file_route)) {
				throw new ValidationError("file_route must be a valid rubrics R2 key");
			}

			const db = DatabaseFactory.create(c.env.DB);
			const repo = new D1ProfileRepository(db);
			const useCase = new UpdateScribeStyleSlotUseCase(repo);

			await useCase.execute({
				userId: auth.userId,
				slot: parsed.data.slot,
				file_route: parsed.data.file_route,
				mimeType: parsed.data.mimeType,
				originalFilename: parsed.data.originalFilename,
			});

			return c.json({ success: true }, 200);
		} catch (e) {
			return handleError(e, c);
		}
	}
}
