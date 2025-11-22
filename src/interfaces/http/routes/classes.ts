import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import {
	toClassDetailDTO,
	toClassListDTO,
} from "../../../application/classes/class.dto";
import { CreateClassUseCase } from "../../../application/classes/create-class.usecase";
import { GetClassUseCase } from "../../../application/classes/get-class.usecase";
import { HardDeleteClassUseCase } from "../../../application/classes/hard-delete-class.usecase";
import { ListClassesUseCase } from "../../../application/classes/list-classes.usecase";
import { SoftDeleteClassUseCase } from "../../../application/classes/soft-delete-class.usecase";
import { UpdateClassUseCase } from "../../../application/classes/update-class.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import type {
	ClassAIStatus,
	ClassStatus,
} from "../../../domain/entities/class";
import type { ClassFilters } from "../../../domain/repositories/class.repository";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1ClassRepository } from "../../../infrastructure/database/repositories/class.repository";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	type CreateClassInput,
	CreateClassSchema,
	ListClassesSchema,
	type UpdateClassInput,
	UpdateClassSchema,
} from "../validators/class.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type ClassContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const ClassListItemSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string().nullable(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	link: z.string().nullable(),
	meeting_link: z.string().nullable(),
	status: z.enum(["scheduled", "live", "completed"]),
	ai_status: z.enum(["none", "processing", "done", "failed"]),
	topics: z.string().nullable(),
	duration_seconds: z.number(),
	room_location: z.string().nullable(),
	is_processed: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
});

const ClassResourceSchema = z.object({
	id: z.string(),
	original_filename: z.string(),
	mime_type: z.string(),
	size_bytes: z.number(),
	association_type: z.string(),
});

const ClassDetailSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string().nullable(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	link: z.string().nullable(),
	meeting_link: z.string().nullable(),
	status: z.enum(["scheduled", "live", "completed"]),
	ai_status: z.enum(["none", "processing", "done", "failed"]),
	topics: z.string().nullable(),
	duration_seconds: z.number(),
	content: z.string().nullable(),
	summary: z.string().nullable(),
	transcription_text: z.string().nullable(),
	room_location: z.string().nullable(),
	is_processed: z.number(),
	is_deleted: z.number(),
	deleted_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	resources: z.array(ClassResourceSchema),
});

const ClassCreateResponseSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string().nullable(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	link: z.string().nullable(),
	meeting_link: z.string().nullable(),
	status: z.enum(["scheduled", "live", "completed"]),
	ai_status: z.enum(["none", "processing", "done", "failed"]),
	topics: z.string().nullable(),
	duration_seconds: z.number(),
	content: z.string().nullable(),
	summary: z.string().nullable(),
	transcription_text: z.string().nullable(),
	room_location: z.string().nullable(),
	is_processed: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
});

const ClassUpdateResponseSchema = z.object({
	id: z.string(),
	subject_id: z.string(),
	title: z.string().nullable(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	link: z.string().nullable(),
	meeting_link: z.string().nullable(),
	status: z.enum(["scheduled", "live", "completed"]),
	ai_status: z.enum(["none", "processing", "done", "failed"]),
	topics: z.string().nullable(),
	duration_seconds: z.number(),
	content: z.string().nullable(),
	summary: z.string().nullable(),
	transcription_text: z.string().nullable(),
	room_location: z.string().nullable(),
	is_processed: z.number(),
	updated_at: z.string(),
});

const ClassSoftDeleteSchema = z.object({
	id: z.string(),
	is_deleted: z.number(),
	deleted_at: z.string().nullable(),
});

const SuccessListResponse = z.object({
	success: z.literal(true),
	result: z.object({
		data: z.array(ClassListItemSchema),
		meta: z.object({
			total: z.number(),
			limit: z.number(),
			offset: z.number(),
		}),
	}),
});

const SuccessDetailResponse = z.object({
	success: z.literal(true),
	result: ClassDetailSchema,
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: ClassCreateResponseSchema,
});

const SuccessUpdateResponse = z.object({
	success: z.literal(true),
	result: ClassUpdateResponseSchema,
});

const SuccessSoftDeleteResponse = z.object({
	success: z.literal(true),
	result: ClassSoftDeleteSchema,
});

const SuccessHardDeleteResponse = z.object({
	success: z.literal(true),
	result: z.object({ id: z.string() }),
});

const CLASS_STATUS_VALUES = ["scheduled", "live", "completed"] as const;
const CLASS_AI_STATUS_VALUES = [
	"none",
	"processing",
	"done",
	"failed",
] as const;

function parseEnumList<T extends string>(
	raw: string | undefined,
	allowed: readonly T[],
	fieldName: string,
): T[] | undefined {
	if (!raw) {
		return undefined;
	}
	const values = raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0)
		.map((value) => value.toLowerCase()) as T[];
	if (values.length === 0) {
		throw new ValidationError(`${fieldName} cannot be empty`);
	}
	const invalid = values.filter((value) => !allowed.includes(value));
	if (invalid.length > 0) {
		throw new ValidationError(
			`${fieldName} contains invalid values: ${invalid.join(", ")}`,
		);
	}
	return values;
}

function parseBooleanFlag(
	value: string | undefined,
	fieldName: string,
): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	const normalized = value.toLowerCase();
	if (normalized === "true" || normalized === "1") {
		return true;
	}
	if (normalized === "false" || normalized === "0") {
		return false;
	}
	throw new ValidationError(`${fieldName} must be one of true,false,1,0`);
}

function ensureAuthenticatedUser(c: ClassContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getClassRepository(c: ClassContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1ClassRepository(db);
}

function validateCreatePayload(body: unknown): CreateClassInput {
	const result = CreateClassSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return {
		subjectId: result.data.subject_id,
		title: result.data.title ?? null,
		startDate: result.data.start_date ?? null,
		endDate: result.data.end_date ?? null,
		link: result.data.link ?? null,
		meetingLink: result.data.meeting_link ?? null,
		status: result.data.status,
		aiStatus: result.data.ai_status,
		topics: result.data.topics ?? null,
		durationSeconds: result.data.duration_seconds,
		content: result.data.content ?? null,
		summary: result.data.summary ?? null,
		transcriptionText: result.data.transcription_text ?? null,
		roomLocation: result.data.room_location ?? null,
		isProcessed: result.data.is_processed,
	};
}

function validateUpdatePayload(body: unknown): UpdateClassInput {
	const result = UpdateClassSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return {
		title: result.data.title,
		startDate: result.data.start_date,
		endDate: result.data.end_date,
		link: result.data.link,
		meetingLink: result.data.meeting_link,
		status: result.data.status,
		aiStatus: result.data.ai_status,
		topics: result.data.topics,
		durationSeconds: result.data.duration_seconds,
		content: result.data.content,
		summary: result.data.summary,
		transcriptionText: result.data.transcription_text,
		roomLocation: result.data.room_location,
		isProcessed: result.data.is_processed,
	};
}

function extractClassId(c: ClassContext): string {
	const classId = c.req.param("id");
	if (!classId) {
		throw new ValidationError("Class ID is required");
	}
	return classId;
}

function validateListQuery(query: Record<string, string>): ClassFilters {
	const result = ListClassesSchema.safeParse(query);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}

	const data = result.data;
	const filters: ClassFilters = {
		subjectId: data.subject_id,
		search: data.search,
		startDateFrom: data.start_date_from,
		startDateTo: data.start_date_to,
		endDateFrom: data.end_date_from,
		endDateTo: data.end_date_to,
		limit: data.limit,
		offset: data.offset,
		sortBy: data.sort_by,
		sortOrder: data.sort_order,
	};

	const statusFilter = parseEnumList<ClassStatus>(
		data.status,
		CLASS_STATUS_VALUES,
		"status",
	);
	if (statusFilter && statusFilter.length > 0) {
		filters.status = statusFilter;
	}

	const aiStatusFilter = parseEnumList<ClassAIStatus>(
		data.ai_status,
		CLASS_AI_STATUS_VALUES,
		"ai_status",
	);
	if (aiStatusFilter && aiStatusFilter.length > 0) {
		filters.aiStatus = aiStatusFilter;
	}

	const isProcessed = parseBooleanFlag(data.is_processed, "is_processed");
	if (isProcessed !== undefined) {
		filters.isProcessed = isProcessed;
	}

	return filters;
}

async function listClasses(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const query = c.req.query();
		const filters = validateListQuery(query);
		const classRepository = getClassRepository(c);
		const listClassesUseCase = new ListClassesUseCase(classRepository);
		const { data, total } = await listClassesUseCase.execute(userId, filters);

		return c.json(
			{
				success: true,
				result: {
					data: data.map((cls) => toClassListDTO(cls)),
					meta: {
						total,
						limit: filters.limit ?? 20,
						offset: filters.offset ?? 0,
					},
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function getClass(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const classId = extractClassId(c);
		const classRepository = getClassRepository(c);
		const useCase = new GetClassUseCase(classRepository);
		const classItem = await useCase.execute(userId, classId);

		if (!classItem) {
			throw new ValidationError("Class not found");
		}

		return c.json(
			{
				success: true,
				result: toClassDetailDTO(classItem),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function createClass(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const payload = validateCreatePayload(await c.req.json());
		const classRepository = getClassRepository(c);
		const useCase = new CreateClassUseCase(classRepository);
		const classItem = await useCase.execute(userId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: classItem.id,
					subject_id: classItem.subjectId,
					title: classItem.title,
					start_date: classItem.startDate,
					end_date: classItem.endDate,
					link: classItem.link,
					meeting_link: classItem.meetingLink,
					status: classItem.status,
					ai_status: classItem.aiStatus,
					topics: classItem.topics,
					duration_seconds: classItem.durationSeconds,
					content: classItem.content,
					summary: classItem.summary,
					transcription_text: classItem.transcriptionText,
					room_location: classItem.roomLocation,
					is_processed: classItem.isProcessed,
					created_at: classItem.createdAt,
					updated_at: classItem.updatedAt,
				},
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function updateClass(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const classId = extractClassId(c);
		const payload = validateUpdatePayload(await c.req.json());
		const classRepository = getClassRepository(c);
		const useCase = new UpdateClassUseCase(classRepository);
		const classItem = await useCase.execute(userId, classId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: classItem.id,
					subject_id: classItem.subjectId,
					title: classItem.title,
					start_date: classItem.startDate,
					end_date: classItem.endDate,
					link: classItem.link,
					meeting_link: classItem.meetingLink,
					status: classItem.status,
					ai_status: classItem.aiStatus,
					topics: classItem.topics,
					duration_seconds: classItem.durationSeconds,
					content: classItem.content,
					summary: classItem.summary,
					transcription_text: classItem.transcriptionText,
					room_location: classItem.roomLocation,
					is_processed: classItem.isProcessed,
					updated_at: classItem.updatedAt,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function softDeleteClass(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const classId = extractClassId(c);
		const classRepository = getClassRepository(c);
		const useCase = new SoftDeleteClassUseCase(classRepository);
		const classItem = await useCase.execute(userId, classId);

		return c.json(
			{
				success: true,
				result: {
					id: classItem.id,
					is_deleted: classItem.isDeleted,
					deleted_at: classItem.deletedAt ?? null,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function hardDeleteClass(c: ClassContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const classId = extractClassId(c);
		const classRepository = getClassRepository(c);
		const useCase = new HardDeleteClassUseCase(classRepository);
		const classItem = await useCase.execute(userId, classId);

		return c.json(
			{
				success: true,
				result: {
					id: classItem.id,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class ListClassesEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "List classes",
		description:
			"List classes with advanced filtering, sorting, and pagination. Subject ID is optional.",
		request: {
			query: ListClassesSchema,
		},
		responses: {
			"200": {
				description: "List of classes returned",
				...contentJson(SuccessListResponse),
			},
			"400": {
				description: "Missing or invalid query parameters",
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

	async handle(c: ClassContext) {
		return listClasses(c);
	}
}

export class GetClassEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Get a class by ID",
		description:
			"Retrieve a single class with all details and associated files.",
		request: {
			params: z.object({ id: z.string().min(1, "Class ID is required") }),
		},
		responses: {
			"200": {
				description: "Class returned with details and resources",
				...contentJson(SuccessDetailResponse),
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
				description: "Class not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ClassContext) {
		return getClass(c);
	}
}

export class CreateClassEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Create a new class",
		description:
			"Create a new class within a subject for the authenticated user.",
		request: {
			body: contentJson(CreateClassSchema),
		},
		responses: {
			"201": {
				description: "Class created successfully",
				...contentJson(SuccessCreateResponse),
			},
			"400": {
				description: "Invalid request body",
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

	async handle(c: ClassContext) {
		return createClass(c);
	}
}

export class UpdateClassEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Update an existing class",
		description:
			"Update an existing class belonging to the authenticated user.",
		request: {
			params: z.object({ id: z.string().min(1, "Class ID is required") }),
			body: contentJson(UpdateClassSchema),
		},
		responses: {
			"200": {
				description: "Class updated successfully",
				...contentJson(SuccessUpdateResponse),
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
				description: "Class not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ClassContext) {
		return updateClass(c);
	}
}

export class SoftDeleteClassEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Soft delete a class",
		description: "Soft delete a class without permanently removing data.",
		request: {
			params: z.object({ id: z.string().min(1, "Class ID is required") }),
		},
		responses: {
			"200": {
				description: "Class soft deleted successfully",
				...contentJson(SuccessSoftDeleteResponse),
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
				description: "Class not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ClassContext) {
		return softDeleteClass(c);
	}
}

export class HardDeleteClassEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Classes"],
		summary: "Hard delete a class",
		description:
			"Irreversibly delete a class and cascade the removal to all related resources.",
		request: {
			params: z.object({ id: z.string().min(1, "Class ID is required") }),
		},
		responses: {
			"200": {
				description: "Class hard deleted successfully",
				...contentJson(SuccessHardDeleteResponse),
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
				description: "Class not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: ClassContext) {
		return hardDeleteClass(c);
	}
}
