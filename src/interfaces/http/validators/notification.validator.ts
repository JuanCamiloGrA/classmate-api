import { z } from "zod";

const NOTIFICATION_TYPES = [
	"class_summary_ready",
	"task_due_soon",
	"grade_posted",
	"system_alert",
] as const;

/**
 * Input data for creating a notification.
 */
export interface CreateNotificationInput {
	userId: string;
	type: (typeof NOTIFICATION_TYPES)[number];
	payload: Record<string, unknown>;
	actionUrl?: string | null;
}

/**
 * Validation schema for creating a notification.
 */
export const CreateNotificationSchema = z.object({
	user_id: z.string().min(1, "User ID is required"),
	type: z.enum(NOTIFICATION_TYPES, {
		errorMap: () => ({
			message: `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}`,
		}),
	}),
	payload: z.record(z.unknown()).default({}),
	action_url: z
		.string()
		.url("Action URL must be a valid URL")
		.nullable()
		.optional(),
});

/**
 * Validation schema for listing notifications.
 */
export const ListNotificationsSchema = z.object({
	type: z.string().optional(), // comma separated
	is_read: z.string().optional(),
	limit: z.coerce.number().min(1).max(100).default(20),
	offset: z.coerce.number().min(0).default(0),
	sort_order: z.enum(["asc", "desc"]).optional(),
});

/**
 * Validation schema for mark as read request.
 */
export const MarkAsReadSchema = z.object({
	is_read: z.coerce.number().min(0).max(1).default(1),
});
