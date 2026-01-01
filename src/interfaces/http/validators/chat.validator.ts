import { z } from "zod";

/**
 * UUID regex for validation.
 * Matches standard UUID format (8-4-4-4-12 hex characters).
 */
export const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Zod schema for UUID validation.
 */
export const UuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID format");

/**
 * Validation schema for creating a new chat.
 * - title: optional string
 * - contextType: optional, must be 'global', 'subject', 'task', or 'pdf'
 * - contextId: optional UUID (required if contextType is not 'global')
 */
export const CreateChatSchema = z.object({
	title: z.string().max(255).nullable().optional(),
	context_type: z
		.enum(["global", "subject", "task", "pdf"])
		.nullable()
		.optional(),
	context_id: z.string().nullable().optional(),
});

/**
 * Type for create chat input.
 */
export type CreateChatInput = z.infer<typeof CreateChatSchema>;

/**
 * Validation schema for chat ID path parameter.
 */
export const ChatIdParamSchema = z.object({
	id: UuidSchema,
});

/**
 * Type for chat ID param.
 */
export type ChatIdParam = z.infer<typeof ChatIdParamSchema>;

/**
 * Validation schema for listing chats.
 */
export const ListChatsQuerySchema = z.object({
	limit: z.coerce.number().min(1).max(100).default(20),
	offset: z.coerce.number().min(0).default(0),
	is_archived: z
		.string()
		.optional()
		.transform((val) =>
			val === "true" ? true : val === "false" ? false : undefined,
		),
	is_pinned: z
		.string()
		.optional()
		.transform((val) =>
			val === "true" ? true : val === "false" ? false : undefined,
		),
	context_type: z.enum(["global", "subject", "task", "pdf"]).optional(),
	context_id: z.string().optional(),
	search: z.string().max(100).optional(),
	sort_order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Type for list chats query.
 */
export type ListChatsQuery = z.infer<typeof ListChatsQuerySchema>;

/**
 * Validation schema for getting messages.
 */
export const GetMessagesQuerySchema = z.object({
	limit: z.coerce.number().min(1).max(500).default(100),
	after_sequence: z.coerce.number().min(0).default(0),
});

/**
 * Type for get messages query.
 */
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;

/**
 * Validation schema for updating a chat.
 */
export const UpdateChatSchema = z
	.object({
		title: z.string().max(255).nullable().optional(),
		is_pinned: z.boolean().optional(),
		is_archived: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided for update",
	});

/**
 * Type for update chat input.
 */
export type UpdateChatInput = z.infer<typeof UpdateChatSchema>;

/**
 * Helper function to check if a string is a valid UUID.
 */
export function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value);
}
