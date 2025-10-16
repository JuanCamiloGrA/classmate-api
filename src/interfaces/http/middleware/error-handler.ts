import type { Context } from "hono";
import { ZodError } from "zod";

type ValidStatusCode = 400 | 401 | 403 | 404 | 500;

export class DomainError extends Error {
	constructor(
		message: string,
		public statusCode: ValidStatusCode = 500,
	) {
		super(message);
		this.name = "DomainError";
	}
}

export class NotFoundError extends DomainError {
	constructor(message: string = "Resource not found") {
		super(message, 404);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends DomainError {
	constructor(message: string = "Validation error") {
		super(message, 400);
		this.name = "ValidationError";
	}
}

export class UnauthorizedError extends DomainError {
	constructor(message: string = "Unauthorized") {
		super(message, 401);
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends DomainError {
	constructor(message: string = "Forbidden") {
		super(message, 403);
		this.name = "ForbiddenError";
	}
}

export function handleError(err: unknown, c: Context) {
	// Domain errors
	if (err instanceof DomainError) {
		return c.json(
			{
				error: err.message,
				name: err.name,
			},
			err.statusCode,
		);
	}

	// Zod validation errors
	if (err instanceof ZodError) {
		return c.json(
			{
				error: "Validation error",
				issues: err.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
					code: issue.code,
				})),
			},
			400,
		);
	}

	// Generic errors
	const message = err instanceof Error ? err.message : "Internal server error";
	const requestId = c.get("requestId");

	console.error(
		JSON.stringify({
			requestId,
			error: message,
			stack: err instanceof Error ? err.stack : undefined,
			timestamp: new Date().toISOString(),
		}),
	);

	return c.json(
		{
			error: "Internal server error",
			requestId,
		},
		500,
	);
}
