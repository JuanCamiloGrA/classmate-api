import { z } from "zod";

/**
 * Query parameters for listing library items.
 */
export const ListLibrarySchema = z.object({
	search: z.string().optional(),
	type: z
		.enum(["all", "scribe_doc", "audio", "pdf", "image", "summary", "other"])
		.default("all")
		.optional(),
	subject_id: z.string().optional(),
	sort_by: z.enum(["date", "name"]).default("date").optional(),
	sort_order: z.enum(["asc", "desc"]).default("desc").optional(),
	limit: z.coerce.number().min(1).max(100).default(50).optional(),
	offset: z.coerce.number().min(0).default(0).optional(),
});

export type ListLibraryInput = z.infer<typeof ListLibrarySchema>;

/**
 * Request body for generating presigned upload URL.
 */
export const GenerateUploadUrlSchema = z.object({
	filename: z.string().min(1, "Filename is required"),
	mimeType: z.string().min(1, "MIME type is required"),
	sizeBytes: z.number().int().positive("Size must be a positive integer"),
	subjectId: z.string().optional(),
	taskId: z.string().optional(),
});

export type GenerateUploadUrlInput = z.infer<typeof GenerateUploadUrlSchema>;

/**
 * Request body for confirming upload.
 */
export const ConfirmUploadSchema = z.object({
	fileId: z.string().min(1, "File ID is required"),
});

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;

/**
 * Query parameters for deleting library item.
 */
export const DeleteLibraryItemSchema = z.object({
	source: z.enum(["user_file", "scribe_project"]),
});

export type DeleteLibraryItemInput = z.infer<typeof DeleteLibraryItemSchema>;
