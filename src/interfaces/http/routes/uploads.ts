import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { ConfirmUploadService } from "../../../application/storage/confirm-upload.service";
import {
	type Bindings,
	resolveSecretBinding,
	type Variables,
} from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { D1StorageAccountingRepository } from "../../../infrastructure/database/repositories/storage-accounting.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type UploadsContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

/**
 * Schema for confirming an upload by R2 key.
 * Used for persistent bucket uploads (Scribe rubrics, profile style slots).
 */
const ConfirmUploadByKeySchema = z.object({
	r2Key: z.string().min(1, "R2 key is required"),
});

const ConfirmUploadResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
	actualSizeBytes: z.number(),
});

/**
 * Validates that the r2Key belongs to the authenticated user.
 * Keys should follow pattern: users/{userId}/...
 */
function validateR2KeyOwnership(userId: string, r2Key: string): boolean {
	const pattern = new RegExp(`^users/${userId}/`);
	return pattern.test(r2Key);
}

async function confirmUploadByKey(c: UploadsContext) {
	try {
		const auth = getAuth(c);
		if (!auth?.userId) {
			throw new UnauthorizedError();
		}

		const body = await c.req.json();
		const result = ConfirmUploadByKeySchema.safeParse(body);
		if (!result.success) {
			throw new ValidationError(
				result.error.issues
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { r2Key } = result.data;

		// Security: Validate that the r2Key belongs to this user
		if (!validateR2KeyOwnership(auth.userId, r2Key)) {
			throw new ValidationError("R2 key does not belong to authenticated user");
		}

		const db = DatabaseFactory.create(c.env.DB);
		const libraryRepository = new D1LibraryRepository(db);
		const storageAccountingRepository = new D1StorageAccountingRepository(db);

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

		const storageAdapter = new R2StorageAdapter({
			endpoint,
			accessKeyId,
			secretAccessKey,
		});

		const confirmService = new ConfirmUploadService(
			storageAccountingRepository,
			libraryRepository,
			storageAdapter,
		);

		const confirmResult = await confirmService.confirmUpload({
			r2Key,
			bucket,
			bucketType: "persistent",
			userId: auth.userId,
		});

		return c.json(
			{
				success: true,
				message: "Upload confirmed successfully",
				actualSizeBytes: confirmResult.actualSizeBytes,
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

/**
 * Generic endpoint for confirming persistent bucket uploads by R2 key.
 * Works for any upload that went through UploadGuardService:
 * - Scribe rubric files
 * - Profile style slots
 * - Any other persistent uploads
 */
export class ConfirmUploadByKeyEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Uploads"],
		summary: "Confirm upload by R2 key",
		description:
			"Confirm that a file upload to R2 persistent storage has completed. " +
			"This updates storage accounting and user quota. Idempotent - safe to call multiple times.",
		request: {
			body: contentJson(ConfirmUploadByKeySchema),
		},
		responses: {
			"200": {
				description: "Upload confirmed successfully",
				...contentJson(ConfirmUploadResponseSchema),
			},
			"400": {
				description: "Invalid request body or R2 key not owned by user",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Object not found in R2",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: UploadsContext) {
		return confirmUploadByKey(c);
	}
}
