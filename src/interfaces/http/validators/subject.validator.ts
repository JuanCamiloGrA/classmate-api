import { z } from "zod";

/**
 * Input data for creating a subject.
 */
export interface CreateSubjectInput {
	name: string;
	termId: string;
}

/**
 * Input data for updating a subject (all optional).
 */
export interface UpdateSubjectInput {
	name?: string;
}

/**
 * Validation schema for creating a new subject.
 * - name: required, non-empty string
 * - termId: required, non-empty string (UUID)
 */
export const CreateSubjectSchema = z.object({
	name: z.string().min(1, "Name is required"),
	termId: z.string().min(1, "Term ID is required"),
});

/**
 * Validation schema for updating a subject.
 * All fields are optional, but at least one must be provided.
 * - name: optional, non-empty string
 */
export const UpdateSubjectSchema = z
	.object({
		name: z.string().min(1, "Name is required").optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});

/**
 * Validation schema for listing subjects by term.
 * - term_id: required, non-empty string (UUID) - snake_case for query parameters
 */
export const ListSubjectsByTermSchema = z.object({
	term_id: z.string().min(1, "Term ID is required"),
});
