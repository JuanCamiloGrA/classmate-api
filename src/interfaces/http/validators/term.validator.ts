import { z } from "zod";

/**
 * Input data for creating a term.
 */
export interface CreateTermInput {
	name: string;
	order: number;
}

/**
 * Input data for updating a term (all optional).
 */
export interface UpdateTermInput {
	name?: string;
	order?: number;
}

/**
 * Validation schema for creating a new term.
 * - name: required, non-empty string
 * - order: required, non-negative integer
 */
export const CreateTermSchema = z.object({
	name: z.string().min(1, "Name is required"),
	order: z
		.number({ coerce: true })
		.int("Order must be an integer")
		.min(0, "Order must be non-negative"),
});

/**
 * Validation schema for updating a term.
 * All fields are optional, but at least one must be provided.
 * - name: optional, non-empty string
 * - order: optional, non-negative integer
 */
export const UpdateTermSchema = z
	.object({
		name: z.string().min(1, "Name is required").optional(),
		order: z
			.number({ coerce: true })
			.int("Order must be an integer")
			.min(0, "Order must be non-negative")
			.optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});
