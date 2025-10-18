import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateSubjectUseCase } from "../../../application/subjects/create-subject.usecase";
import { HardDeleteSubjectUseCase } from "../../../application/subjects/hard-delete-subject.usecase";
import { ListSubjectsUseCase } from "../../../application/subjects/list-subjects.usecase";
import { SoftDeleteSubjectUseCase } from "../../../application/subjects/soft-delete-subject.usecase";
import { UpdateSubjectUseCase } from "../../../application/subjects/update-subject.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1SubjectRepository } from "../../../infrastructure/database/repositories/subject.repository";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	type CreateSubjectInput,
	CreateSubjectSchema,
	ListSubjectsByTermSchema,
	type UpdateSubjectInput,
	UpdateSubjectSchema,
} from "../validators/subject.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type SubjectContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const SubjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	termId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const SubjectUpdateSchema = SubjectSchema.pick({
	id: true,
	name: true,
	termId: true,
	updatedAt: true,
});

const SubjectSoftDeleteSchema = z.object({
	id: z.string(),
	isDeleted: z.number(),
	deletedAt: z.string().nullable(),
});

const SuccessListResponse = z.object({
	success: z.literal(true),
	result: z.array(SubjectSchema),
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: SubjectSchema,
});

const SuccessUpdateResponse = z.object({
	success: z.literal(true),
	result: SubjectUpdateSchema,
});

const SuccessSoftDeleteResponse = z.object({
	success: z.literal(true),
	result: SubjectSoftDeleteSchema,
});

const SuccessHardDeleteResponse = z.object({
	success: z.literal(true),
	result: z.object({ id: z.string() }),
});

function ensureAuthenticatedUser(c: SubjectContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getSubjectRepository(c: SubjectContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1SubjectRepository(db);
}

function validateCreatePayload(body: unknown): CreateSubjectInput {
	const result = CreateSubjectSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data as CreateSubjectInput;
}

function validateUpdatePayload(body: unknown): UpdateSubjectInput {
	const result = UpdateSubjectSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data as UpdateSubjectInput;
}

function extractSubjectId(c: SubjectContext): string {
	const subjectId = c.req.param("id");
	if (!subjectId) {
		throw new ValidationError("Subject ID is required");
	}
	return subjectId;
}

function validateTermIdQuery(query: Record<string, string>): string {
	const result = ListSubjectsByTermSchema.safeParse(query);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data.term_id;
}

async function listSubjects(c: SubjectContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const query = c.req.query();
		const termId = validateTermIdQuery(query);
		const subjectRepository = getSubjectRepository(c);
		const listSubjectsUseCase = new ListSubjectsUseCase(subjectRepository);
		const subjects = await listSubjectsUseCase.execute(userId, termId);

		return c.json(
			{
				success: true,
				result: subjects.map((subject) => ({
					id: subject.id,
					name: subject.name,
					termId: subject.termId,
					createdAt: subject.createdAt,
					updatedAt: subject.updatedAt,
				})),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function createSubject(c: SubjectContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const payload = validateCreatePayload(await c.req.json());
		const subjectRepository = getSubjectRepository(c);
		const useCase = new CreateSubjectUseCase(subjectRepository);
		const subject = await useCase.execute(userId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: subject.id,
					name: subject.name,
					termId: subject.termId,
					createdAt: subject.createdAt,
					updatedAt: subject.updatedAt,
				},
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function updateSubject(c: SubjectContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const subjectId = extractSubjectId(c);
		const payload = validateUpdatePayload(await c.req.json());
		const subjectRepository = getSubjectRepository(c);
		const useCase = new UpdateSubjectUseCase(subjectRepository);
		const subject = await useCase.execute(userId, subjectId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: subject.id,
					name: subject.name,
					termId: subject.termId,
					updatedAt: subject.updatedAt,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function softDeleteSubject(c: SubjectContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const subjectId = extractSubjectId(c);
		const subjectRepository = getSubjectRepository(c);
		const useCase = new SoftDeleteSubjectUseCase(subjectRepository);
		const subject = await useCase.execute(userId, subjectId);

		return c.json(
			{
				success: true,
				result: {
					id: subject.id,
					isDeleted: subject.isDeleted,
					deletedAt: subject.deletedAt ?? null,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function hardDeleteSubject(c: SubjectContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const subjectId = extractSubjectId(c);
		const subjectRepository = getSubjectRepository(c);
		const useCase = new HardDeleteSubjectUseCase(subjectRepository);
		const subject = await useCase.execute(userId, subjectId);

		return c.json(
			{
				success: true,
				result: {
					id: subject.id,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class ListSubjectsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Subjects"],
		summary: "List subjects for a term",
		description:
			"List all non-deleted subjects for a specific term. Requires term_id query parameter.",
		request: {
			query: ListSubjectsByTermSchema,
		},
		responses: {
			"200": {
				description: "List of subjects returned",
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

	async handle(c: SubjectContext) {
		return listSubjects(c);
	}
}

export class CreateSubjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Subjects"],
		summary: "Create a new subject",
		description:
			"Create a new subject within a term for the authenticated user.",
		request: {
			body: contentJson(CreateSubjectSchema),
		},
		responses: {
			"201": {
				description: "Subject created successfully",
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

	async handle(c: SubjectContext) {
		return createSubject(c);
	}
}

export class UpdateSubjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Subjects"],
		summary: "Update an existing subject",
		description:
			"Update the name of an existing subject belonging to the authenticated user.",
		request: {
			params: z.object({ id: z.string().min(1, "Subject ID is required") }),
			body: contentJson(UpdateSubjectSchema),
		},
		responses: {
			"200": {
				description: "Subject updated successfully",
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
				description: "Subject not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: SubjectContext) {
		return updateSubject(c);
	}
}

export class SoftDeleteSubjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Subjects"],
		summary: "Soft delete a subject",
		description:
			"Soft delete a subject and cascade the deletion to related tasks and classes without removing data permanently.",
		request: {
			params: z.object({ id: z.string().min(1, "Subject ID is required") }),
		},
		responses: {
			"200": {
				description: "Subject soft deleted successfully",
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
				description: "Subject not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: SubjectContext) {
		return softDeleteSubject(c);
	}
}

export class HardDeleteSubjectEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Subjects"],
		summary: "Hard delete a subject",
		description:
			"Irreversibly delete a subject and cascade the removal to all related tasks and classes.",
		request: {
			params: z.object({ id: z.string().min(1, "Subject ID is required") }),
		},
		responses: {
			"200": {
				description: "Subject hard deleted successfully",
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
				description: "Subject not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: SubjectContext) {
		return hardDeleteSubject(c);
	}
}
