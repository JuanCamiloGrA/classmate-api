import { z } from "zod";

const optionalLinkSchema = z.preprocess((value) => {
	if (value === undefined) {
		return undefined;
	}
	if (value === null) {
		return null;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed === "" ? null : trimmed;
	}
	return value;
}, z.string().url("Link must be a valid URL").nullable().optional());

/**
 * Input data for creating a class.
 */
export interface CreateClassInput {
	subjectId: string;
	title?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	link?: string | null;
	meetingLink?: string | null;
	status?: "scheduled" | "live" | "completed";
	aiStatus?: "none" | "processing" | "done" | "failed";
	topics?: string | null;
	durationSeconds?: number;
	content?: string | null;
	summary?: string | null;
	transcriptionText?: string | null;
	roomLocation?: string | null;
	isProcessed?: number;
}

/**
 * Input data for updating a class (all optional).
 */
export interface UpdateClassInput {
	title?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	link?: string | null;
	meetingLink?: string | null;
	status?: "scheduled" | "live" | "completed";
	aiStatus?: "none" | "processing" | "done" | "failed";
	topics?: string | null;
	durationSeconds?: number;
	content?: string | null;
	summary?: string | null;
	transcriptionText?: string | null;
	roomLocation?: string | null;
	isProcessed?: number;
}

/**
 * Validation schema for creating a new class.
 * - subject_id: required, non-empty string (UUID)
 * - title: optional, string
 * - start_date: optional, ISO 8601 datetime string
 * - end_date: optional, ISO 8601 datetime string
 * - link: optional, string (URL)
 * - content: optional, string
 * - summary: optional, string
 */
export const CreateClassSchema = z.object({
	subject_id: z.string().min(1, "Subject ID is required"),
	title: z.string().nullable().optional(),
	start_date: z.string().datetime().nullable().optional(),
	end_date: z.string().datetime().nullable().optional(),
	link: optionalLinkSchema,
	meeting_link: optionalLinkSchema,
	status: z.enum(["scheduled", "live", "completed"]).optional(),
	ai_status: z.enum(["none", "processing", "done", "failed"]).optional(),
	topics: z.string().nullable().optional(),
	duration_seconds: z.coerce.number().int().min(0).optional(),
	content: z.string().nullable().optional(),
	summary: z.string().nullable().optional(),
	transcription_text: z.string().nullable().optional(),
	room_location: z.string().nullable().optional(),
	is_processed: z.coerce.number().int().min(0).max(1).optional(),
});

/**
 * Validation schema for updating a class.
 * All fields are optional, but at least one must be provided.
 */
export const UpdateClassSchema = z
	.object({
		title: z.string().nullable().optional(),
		start_date: z.string().datetime().nullable().optional(),
		end_date: z.string().datetime().nullable().optional(),
		link: optionalLinkSchema,
		meeting_link: optionalLinkSchema,
		status: z.enum(["scheduled", "live", "completed"]).optional(),
		ai_status: z.enum(["none", "processing", "done", "failed"]).optional(),
		topics: z.string().nullable().optional(),
		duration_seconds: z.coerce.number().int().min(0).optional(),
		content: z.string().nullable().optional(),
		summary: z.string().nullable().optional(),
		transcription_text: z.string().nullable().optional(),
		room_location: z.string().nullable().optional(),
		is_processed: z.coerce.number().int().min(0).max(1).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});

/**
 * Validation schema for listing classes with advanced filters.
 */
export const ListClassesSchema = z.object({
	subject_id: z.string().optional(),
	status: z.string().optional(), // comma separated
	ai_status: z.string().optional(), // comma separated
	is_processed: z.string().optional(),
	search: z.string().optional(),
	start_date_from: z.string().datetime().optional(),
	start_date_to: z.string().datetime().optional(),
	end_date_from: z.string().datetime().optional(),
	end_date_to: z.string().datetime().optional(),
	limit: z.coerce.number().min(1).max(100).default(20),
	offset: z.coerce.number().min(0).default(0),
	sort_by: z.enum(["startDate", "createdAt", "status"]).optional(),
	sort_order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Validation schema for generating presigned upload URL.
 * - file_name: required, non-empty string
 * - content_type: required, must be a valid MIME type for audio
 */
export const GenerateUploadUrlSchema = z.object({
	file_name: z.string().min(1, "File name is required"),
	content_type: z
		.string()
		.min(1, "Content type is required")
		.refine(
			(val) => val.startsWith("audio/"),
			"Content type must be an audio MIME type",
		),
});

/**
 * Validation schema for processing audio files.
 * - r2_key: required, R2 object key for the uploaded file
 * - file_name: required, original filename
 * - mime_type: required, MIME type of the file
 */
export const ProcessAudioSchema = z.object({
	r2_key: z.string().min(1, "R2 key is required"),
	file_name: z.string().min(1, "File name is required"),
	mime_type: z.string().min(1, "MIME type is required"),
});

/**
 * Validation schema for processing a class from URL.
 * - source_url: required, must be a valid URL
 */
export const ProcessUrlSchema = z.object({
	source_url: z.string().url("A valid URL is required"),
});
