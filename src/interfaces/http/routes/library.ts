import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { ConfirmUploadUseCase } from "../../../application/library/confirm-upload.usecase";
import { DeleteLibraryItemUseCase } from "../../../application/library/delete-library-item.usecase";
import {
	GenerateUploadUrlUseCase,
	StorageQuotaExceededError,
} from "../../../application/library/generate-upload-url.usecase";
import { GetStorageUsageUseCase } from "../../../application/library/get-storage-usage.usecase";
import { ListLibraryItemsUseCase } from "../../../application/library/list-library-items.usecase";
import {
	type Bindings,
	resolveSecretBinding,
	type Variables,
} from "../../../config/bindings";
import type { LibraryItemType } from "../../../domain/entities/library";
import type { LibraryFilters } from "../../../domain/repositories/library.repository";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1LibraryRepository } from "../../../infrastructure/database/repositories/library.repository";
import { R2StorageAdapter } from "../../../infrastructure/storage/r2.storage";
import {
	handleError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	ConfirmUploadSchema,
	DeleteLibraryItemSchema,
	GenerateUploadUrlSchema,
	ListLibrarySchema,
} from "../validators/library.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type LibraryContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

// Response schemas
const LibraryItemSchema = z.object({
	id: z.string(),
	source: z.enum(["user_file", "scribe_project"]),
	title: z.string(),
	type: z.enum(["scribe_doc", "audio", "pdf", "image", "summary", "other"]),
	subject: z.string().nullable(),
	subjectColor: z.string().nullable(),
	date: z.string(),
	size: z.string(),
	status: z.string(),
	linkedTaskId: z.string().nullable(),
	linkedTaskTitle: z.string().nullable(),
	downloadUrl: z.string().nullable(),
});

const LibraryListResponseSchema = z.object({
	success: z.literal(true),
	meta: z.object({
		total: z.number(),
		limit: z.number(),
		offset: z.number(),
	}),
	result: z.array(LibraryItemSchema),
});

const StorageUsageResponseSchema = z.object({
	success: z.literal(true),
	result: z.object({
		usedBytes: z.number(),
		totalBytes: z.number(),
		usedFormatted: z.string(),
		totalFormatted: z.string(),
		percentage: z.number(),
		tier: z.enum(["free", "pro", "premium"]),
	}),
});

const PresignedUploadResponseSchema = z.object({
	success: z.literal(true),
	result: z.object({
		uploadUrl: z.string(),
		fileId: z.string(),
		r2Key: z.string(),
	}),
});

const ConfirmUploadResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
});

const DeleteItemResponseSchema = z.object({
	success: z.literal(true),
	message: z.string(),
});

// Helper functions
function ensureAuthenticatedUser(c: LibraryContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getLibraryRepository(c: LibraryContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1LibraryRepository(db);
}

async function getStorageAdapter(c: LibraryContext) {
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

	return new R2StorageAdapter({ endpoint, accessKeyId, secretAccessKey });
}

async function getBucketName(c: LibraryContext): Promise<string> {
	return resolveSecretBinding(
		c.env.R2_PERSISTENT_BUCKET_NAME,
		"R2_PERSISTENT_BUCKET_NAME",
	);
}

function validateListQuery(query: Record<string, string>): LibraryFilters {
	const result = ListLibrarySchema.safeParse(query);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}

	const data = result.data;
	return {
		search: data.search,
		type: data.type as LibraryItemType | "all",
		subjectId: data.subject_id,
		sortBy: data.sort_by,
		sortOrder: data.sort_order,
		limit: data.limit,
		offset: data.offset,
	};
}

// Handler functions
async function listLibraryItems(c: LibraryContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const query = c.req.query();
		const filters = validateListQuery(query);

		const repository = getLibraryRepository(c);
		const useCase = new ListLibraryItemsUseCase(repository);
		const { data, total } = await useCase.execute({ userId, filters });

		return c.json(
			{
				success: true,
				meta: {
					total,
					limit: filters.limit ?? 50,
					offset: filters.offset ?? 0,
				},
				result: data,
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function getStorageUsage(c: LibraryContext) {
	try {
		const userId = ensureAuthenticatedUser(c);

		const repository = getLibraryRepository(c);
		const useCase = new GetStorageUsageUseCase(repository);
		const usage = await useCase.execute(userId);

		if (!usage) {
			throw new NotFoundError("User profile not found");
		}

		return c.json(
			{
				success: true,
				result: usage,
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function generateUploadUrl(c: LibraryContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const body = await c.req.json();

		const result = GenerateUploadUrlSchema.safeParse(body);
		if (!result.success) {
			throw new ValidationError(
				result.error.errors
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { filename, mimeType, sizeBytes, subjectId, taskId } = result.data;

		const repository = getLibraryRepository(c);
		const storageAdapter = await getStorageAdapter(c);
		const bucket = await getBucketName(c);

		const expiresInSeconds = c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS
			? Number.parseInt(c.env.R2_PRESIGNED_URL_EXPIRATION_SECONDS, 10)
			: 3600;

		const useCase = new GenerateUploadUrlUseCase(repository, storageAdapter, {
			bucket,
			expiresInSeconds,
		});

		const uploadResult = await useCase.execute({
			userId,
			filename,
			mimeType,
			sizeBytes,
			subjectId,
			taskId,
		});

		return c.json(
			{
				success: true,
				result: uploadResult,
			},
			200,
		);
	} catch (error) {
		if (error instanceof StorageQuotaExceededError) {
			return c.json({ error: error.message }, 402);
		}
		return handleError(error, c);
	}
}

async function confirmUpload(c: LibraryContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const body = await c.req.json();

		const result = ConfirmUploadSchema.safeParse(body);
		if (!result.success) {
			throw new ValidationError(
				result.error.errors
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const { fileId } = result.data;

		const repository = getLibraryRepository(c);
		const useCase = new ConfirmUploadUseCase(repository);
		const confirmed = await useCase.execute({ fileId, userId });

		if (!confirmed) {
			throw new NotFoundError("File not found or not owned by user");
		}

		return c.json(
			{
				success: true,
				message: "Upload confirmed successfully",
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function deleteLibraryItem(c: LibraryContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const id = c.req.param("id");
		const query = c.req.query();

		if (!id) {
			throw new ValidationError("Item ID is required");
		}

		const result = DeleteLibraryItemSchema.safeParse(query);
		if (!result.success) {
			throw new ValidationError(
				"source query parameter is required (user_file or scribe_project)",
			);
		}

		const { source } = result.data;

		const repository = getLibraryRepository(c);
		const useCase = new DeleteLibraryItemUseCase(repository);
		const deleted = await useCase.execute({ id, source, userId });

		if (!deleted) {
			throw new NotFoundError("Item not found or not owned by user");
		}

		return c.json(
			{
				success: true,
				message: "Item deleted successfully",
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

// OpenAPI Endpoint classes
export class ListLibraryEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Library"],
		summary: "List library items",
		description:
			"Retrieve a paginated, sorted, and filtered list of both files and scribe projects.",
		request: {
			query: ListLibrarySchema,
		},
		responses: {
			"200": {
				description: "List of library items returned",
				...contentJson(LibraryListResponseSchema),
			},
			"400": {
				description: "Invalid query parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: LibraryContext) {
		return listLibraryItems(c);
	}
}

export class GetStorageUsageEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Library"],
		summary: "Get storage usage",
		description:
			"Get the user's current storage usage and quota based on subscription tier.",
		responses: {
			"200": {
				description: "Storage usage information returned",
				...contentJson(StorageUsageResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "User profile not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: LibraryContext) {
		return getStorageUsage(c);
	}
}

export class GenerateUploadUrlEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Library"],
		summary: "Generate presigned upload URL",
		description:
			"Generate a presigned URL for uploading a file directly to R2 storage.",
		request: {
			body: contentJson(GenerateUploadUrlSchema),
		},
		responses: {
			"200": {
				description: "Presigned upload URL generated",
				...contentJson(PresignedUploadResponseSchema),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"402": {
				description: "Storage quota exceeded",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: LibraryContext) {
		return generateUploadUrl(c);
	}
}

export class ConfirmUploadEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Library"],
		summary: "Confirm file upload",
		description:
			"Confirm that a file upload to R2 has completed successfully and update storage usage.",
		request: {
			body: contentJson(ConfirmUploadSchema),
		},
		responses: {
			"200": {
				description: "Upload confirmed successfully",
				...contentJson(ConfirmUploadResponseSchema),
			},
			"400": {
				description: "Invalid request body",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "File not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: LibraryContext) {
		return confirmUpload(c);
	}
}

export class DeleteLibraryItemEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Library"],
		summary: "Delete library item",
		description:
			"Delete a file (hard delete + R2 cleanup) or scribe project (soft delete).",
		request: {
			params: z.object({ id: z.string().min(1, "Item ID is required") }),
			query: DeleteLibraryItemSchema,
		},
		responses: {
			"200": {
				description: "Item deleted successfully",
				...contentJson(DeleteItemResponseSchema),
			},
			"400": {
				description: "Invalid request parameters",
				...contentJson(ErrorResponseSchema),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Item not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: LibraryContext) {
		return deleteLibraryItem(c);
	}
}
