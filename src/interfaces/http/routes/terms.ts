import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateTermUseCase } from "../../../application/terms/create-term.usecase";
import { HardDeleteTermUseCase } from "../../../application/terms/hard-delete-term.usecase";
import { ListTermsUseCase } from "../../../application/terms/list-terms.usecase";
import { SoftDeleteTermUseCase } from "../../../application/terms/soft-delete-term.usecase";
import { UpdateTermUseCase } from "../../../application/terms/update-term.usecase";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1TermRepository } from "../../../infrastructure/database/repositories/term.repository";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	type CreateTermInput,
	CreateTermSchema,
	type UpdateTermInput,
	UpdateTermSchema,
} from "../validators/term.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type TermContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const TermSchema = z.object({
	id: z.string(),
	name: z.string(),
	order: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const TermUpdateSchema = TermSchema.pick({
	id: true,
	name: true,
	order: true,
	updatedAt: true,
});

const TermSoftDeleteSchema = z.object({
	id: z.string(),
	isDeleted: z.boolean(),
	deletedAt: z.string().nullable(),
});

const SuccessListResponse = z.object({
	success: z.literal(true),
	result: z.array(TermSchema),
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: TermSchema,
});

const SuccessUpdateResponse = z.object({
	success: z.literal(true),
	result: TermUpdateSchema,
});

const SuccessSoftDeleteResponse = z.object({
	success: z.literal(true),
	result: TermSoftDeleteSchema,
});

const SuccessHardDeleteResponse = z.object({
	success: z.literal(true),
	result: z.object({ id: z.string() }),
});

function ensureAuthenticatedUser(c: TermContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getTermRepository(c: TermContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1TermRepository(db);
}

function validateCreatePayload(body: unknown): CreateTermInput {
	const result = CreateTermSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data as CreateTermInput;
}

function validateUpdatePayload(body: unknown): UpdateTermInput {
	const result = UpdateTermSchema.safeParse(body);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}
	return result.data as UpdateTermInput;
}

function extractTermId(c: TermContext): string {
	const termId = c.req.param("id");
	if (!termId) {
		throw new ValidationError("Term ID is required");
	}
	return termId;
}

async function listTerms(c: TermContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const termRepository = getTermRepository(c);
		const listTermsUseCase = new ListTermsUseCase(termRepository);
		const terms = await listTermsUseCase.execute(userId);

		return c.json(
			{
				success: true,
				result: terms.map((term) => ({
					id: term.id,
					name: term.name,
					order: term.order,
					createdAt: term.createdAt,
					updatedAt: term.updatedAt,
				})),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function createTerm(c: TermContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const payload = validateCreatePayload(await c.req.json());
		const termRepository = getTermRepository(c);
		const useCase = new CreateTermUseCase(termRepository);
		const term = await useCase.execute(userId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: term.id,
					name: term.name,
					order: term.order,
					createdAt: term.createdAt,
					updatedAt: term.updatedAt,
				},
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function updateTerm(c: TermContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const termId = extractTermId(c);
		const payload = validateUpdatePayload(await c.req.json());
		const termRepository = getTermRepository(c);
		const useCase = new UpdateTermUseCase(termRepository);
		const term = await useCase.execute(userId, termId, payload);

		return c.json(
			{
				success: true,
				result: {
					id: term.id,
					name: term.name,
					order: term.order,
					updatedAt: term.updatedAt,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function softDeleteTerm(c: TermContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const termId = extractTermId(c);
		const termRepository = getTermRepository(c);
		const useCase = new SoftDeleteTermUseCase(termRepository);
		const term = await useCase.execute(userId, termId);

		return c.json(
			{
				success: true,
				result: {
					id: term.id,
					isDeleted: term.isDeleted,
					deletedAt: term.deletedAt ?? null,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function hardDeleteTerm(c: TermContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const termId = extractTermId(c);
		const termRepository = getTermRepository(c);
		const useCase = new HardDeleteTermUseCase(termRepository);
		const term = await useCase.execute(userId, termId);

		return c.json(
			{
				success: true,
				result: {
					id: term.id,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

export class ListTermsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Terms"],
		summary: "List all terms",
		description:
			"List all non-deleted terms for the authenticated user ordered by the order field (ascending).",
		responses: {
			"200": {
				description: "List of terms returned",
				...contentJson(SuccessListResponse),
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

	async handle(c: TermContext) {
		return listTerms(c);
	}
}

export class CreateTermEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Terms"],
		summary: "Create a new term",
		description: "Create a new term associated with the authenticated user.",
		request: {
			body: contentJson(CreateTermSchema),
		},
		responses: {
			"201": {
				description: "Term created successfully",
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

	async handle(c: TermContext) {
		return createTerm(c);
	}
}

export class UpdateTermEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Terms"],
		summary: "Update an existing term",
		description:
			"Update the name and/or order of an existing term belonging to the authenticated user.",
		request: {
			params: z.object({ id: z.string().min(1, "Term ID is required") }),
			body: contentJson(UpdateTermSchema),
		},
		responses: {
			"200": {
				description: "Term updated successfully",
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
				description: "Term not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TermContext) {
		return updateTerm(c);
	}
}

export class SoftDeleteTermEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Terms"],
		summary: "Soft delete a term",
		description:
			"Soft delete a term and cascade the deletion to related entities without removing data permanently.",
		request: {
			params: z.object({ id: z.string().min(1, "Term ID is required") }),
		},
		responses: {
			"200": {
				description: "Term soft deleted successfully",
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
				description: "Term not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TermContext) {
		return softDeleteTerm(c);
	}
}

export class HardDeleteTermEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Terms"],
		summary: "Hard delete a term",
		description:
			"Irreversibly delete a term and cascade the removal to all related entities.",
		request: {
			params: z.object({ id: z.string().min(1, "Term ID is required") }),
		},
		responses: {
			"200": {
				description: "Term hard deleted successfully",
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
				description: "Term not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: TermContext) {
		return hardDeleteTerm(c);
	}
}
