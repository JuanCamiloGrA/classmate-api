import { contentJson, OpenAPIRoute } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { CreateNotificationUseCase } from "../../../application/notifications/create-notification.usecase";
import { DeleteNotificationUseCase } from "../../../application/notifications/delete-notification.usecase";
import { GetNotificationUseCase } from "../../../application/notifications/get-notification.usecase";
import { GetUnreadCountUseCase } from "../../../application/notifications/get-unread-count.usecase";
import { ListNotificationsUseCase } from "../../../application/notifications/list-notifications.usecase";
import { MarkAllNotificationsReadUseCase } from "../../../application/notifications/mark-all-notifications-read.usecase";
import { MarkNotificationReadUseCase } from "../../../application/notifications/mark-notification-read.usecase";
import {
	toNotificationDetailDTO,
	toNotificationListDTO,
} from "../../../application/notifications/notification.dto";
import type { Bindings, Variables } from "../../../config/bindings";
import type { NotificationType } from "../../../domain/entities/notification";
import type { NotificationFilters } from "../../../domain/repositories/notification.repository";
import { getAuth } from "../../../infrastructure/auth";
import { DatabaseFactory } from "../../../infrastructure/database/client";
import { D1NotificationRepository } from "../../../infrastructure/database/repositories/notification.repository";
import {
	handleError,
	UnauthorizedError,
	ValidationError,
} from "../middleware/error-handler";
import {
	CreateNotificationSchema,
	ListNotificationsSchema,
} from "../validators/notification.validator";

type HonoContext = { Bindings: Bindings; Variables: Variables };
type NotificationContext = Context<HonoContext>;

const ErrorResponseSchema = z.object({ error: z.string() });

const NOTIFICATION_TYPES = [
	"class_summary_ready",
	"task_due_soon",
	"grade_posted",
	"system_alert",
] as const;

const NotificationListItemSchema = z.object({
	id: z.string(),
	type: z.enum(NOTIFICATION_TYPES),
	payload: z.record(z.unknown()),
	is_read: z.number(),
	action_url: z.string().nullable(),
	created_at: z.string(),
});

const NotificationDetailSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	type: z.enum(NOTIFICATION_TYPES),
	payload: z.record(z.unknown()),
	is_read: z.number(),
	read_at: z.string().nullable(),
	action_url: z.string().nullable(),
	created_at: z.string(),
});

const SuccessListResponse = z.object({
	success: z.literal(true),
	result: z.object({
		data: z.array(NotificationListItemSchema),
		meta: z.object({
			total: z.number(),
			unread_count: z.number(),
			limit: z.number(),
			offset: z.number(),
		}),
	}),
});

const SuccessDetailResponse = z.object({
	success: z.literal(true),
	result: NotificationDetailSchema,
});

const SuccessCreateResponse = z.object({
	success: z.literal(true),
	result: NotificationDetailSchema,
});

const SuccessMarkReadResponse = z.object({
	success: z.literal(true),
	result: z.object({
		id: z.string(),
		is_read: z.number(),
		read_at: z.string().nullable(),
	}),
});

const SuccessMarkAllReadResponse = z.object({
	success: z.literal(true),
	result: z.object({
		marked_count: z.number(),
	}),
});

const SuccessDeleteResponse = z.object({
	success: z.literal(true),
	result: z.object({ id: z.string() }),
});

const SuccessUnreadCountResponse = z.object({
	success: z.literal(true),
	result: z.object({
		unread_count: z.number(),
	}),
});

function ensureAuthenticatedUser(c: NotificationContext): string {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new UnauthorizedError();
	}
	return auth.userId;
}

function getNotificationRepository(c: NotificationContext) {
	const db = DatabaseFactory.create(c.env.DB);
	return new D1NotificationRepository(db);
}

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
		.filter((value) => value.length > 0) as T[];
	if (values.length === 0) {
		return undefined;
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

function extractNotificationId(c: NotificationContext): string {
	const id = c.req.param("id");
	if (!id) {
		throw new ValidationError("Notification ID is required");
	}
	return id;
}

function validateListQuery(query: Record<string, string>): NotificationFilters {
	const result = ListNotificationsSchema.safeParse(query);
	if (!result.success) {
		throw new ValidationError(
			result.error.errors
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; "),
		);
	}

	const data = result.data;
	const filters: NotificationFilters = {
		limit: data.limit,
		offset: data.offset,
		sortOrder: data.sort_order,
	};

	const typeFilter = parseEnumList<NotificationType>(
		data.type,
		NOTIFICATION_TYPES,
		"type",
	);
	if (typeFilter && typeFilter.length > 0) {
		filters.type = typeFilter;
	}

	const isRead = parseBooleanFlag(data.is_read, "is_read");
	if (isRead !== undefined) {
		filters.isRead = isRead;
	}

	return filters;
}

async function listNotifications(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const query = c.req.query();
		const filters = validateListQuery(query);
		const repository = getNotificationRepository(c);
		const useCase = new ListNotificationsUseCase(repository);
		const { data, total, unreadCount } = await useCase.execute(userId, filters);

		return c.json(
			{
				success: true,
				result: {
					data: data.map((n) => toNotificationListDTO(n)),
					meta: {
						total,
						unread_count: unreadCount,
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

async function getNotification(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const notificationId = extractNotificationId(c);
		const repository = getNotificationRepository(c);
		const useCase = new GetNotificationUseCase(repository);
		const notification = await useCase.execute(userId, notificationId);

		return c.json(
			{
				success: true,
				result: toNotificationDetailDTO(notification),
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function createNotification(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const body = await c.req.json();
		const result = CreateNotificationSchema.safeParse(body);
		if (!result.success) {
			throw new ValidationError(
				result.error.errors
					.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
					.join("; "),
			);
		}

		const repository = getNotificationRepository(c);
		const useCase = new CreateNotificationUseCase(repository);
		const notification = await useCase.execute({
			userId,
			type: result.data.type,
			payload: result.data.payload,
			actionUrl: result.data.action_url ?? null,
		});

		return c.json(
			{
				success: true,
				result: toNotificationDetailDTO(notification),
			},
			201,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function markNotificationRead(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const notificationId = extractNotificationId(c);
		const repository = getNotificationRepository(c);
		const useCase = new MarkNotificationReadUseCase(repository);
		const notification = await useCase.execute(userId, notificationId);

		return c.json(
			{
				success: true,
				result: {
					id: notification.id,
					is_read: notification.isRead,
					read_at: notification.readAt,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function markAllNotificationsRead(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const repository = getNotificationRepository(c);
		const useCase = new MarkAllNotificationsReadUseCase(repository);
		const markedCount = await useCase.execute(userId);

		return c.json(
			{
				success: true,
				result: {
					marked_count: markedCount,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function deleteNotification(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const notificationId = extractNotificationId(c);
		const repository = getNotificationRepository(c);
		const useCase = new DeleteNotificationUseCase(repository);
		const notification = await useCase.execute(userId, notificationId);

		return c.json(
			{
				success: true,
				result: { id: notification.id },
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

async function getUnreadCount(c: NotificationContext) {
	try {
		const userId = ensureAuthenticatedUser(c);
		const repository = getNotificationRepository(c);
		const useCase = new GetUnreadCountUseCase(repository);
		const count = await useCase.execute(userId);

		return c.json(
			{
				success: true,
				result: {
					unread_count: count,
				},
			},
			200,
		);
	} catch (error) {
		return handleError(error, c);
	}
}

// OpenAPI Endpoint Classes

export class ListNotificationsEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "List notifications",
		description:
			"List notifications for the authenticated user with filtering and pagination.",
		request: {
			query: ListNotificationsSchema,
		},
		responses: {
			"200": {
				description: "List of notifications returned",
				...contentJson(SuccessListResponse),
			},
			"400": {
				description: "Invalid query parameters",
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

	async handle(c: NotificationContext) {
		return listNotifications(c);
	}
}

export class GetNotificationEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Get a notification by ID",
		description: "Retrieve a single notification with all details.",
		request: {
			params: z.object({
				id: z.string().min(1, "Notification ID is required"),
			}),
		},
		responses: {
			"200": {
				description: "Notification returned",
				...contentJson(SuccessDetailResponse),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Notification not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: NotificationContext) {
		return getNotification(c);
	}
}

export class CreateNotificationEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Create a notification",
		description: "Create a new notification for the authenticated user.",
		request: {
			body: contentJson(CreateNotificationSchema),
		},
		responses: {
			"201": {
				description: "Notification created successfully",
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

	async handle(c: NotificationContext) {
		return createNotification(c);
	}
}

export class MarkNotificationReadEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Mark notification as read",
		description: "Mark a single notification as read.",
		request: {
			params: z.object({
				id: z.string().min(1, "Notification ID is required"),
			}),
		},
		responses: {
			"200": {
				description: "Notification marked as read",
				...contentJson(SuccessMarkReadResponse),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Notification not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: NotificationContext) {
		return markNotificationRead(c);
	}
}

export class MarkAllNotificationsReadEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Mark all notifications as read",
		description: "Mark all unread notifications as read for the current user.",
		responses: {
			"200": {
				description: "All notifications marked as read",
				...contentJson(SuccessMarkAllReadResponse),
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

	async handle(c: NotificationContext) {
		return markAllNotificationsRead(c);
	}
}

export class DeleteNotificationEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Delete a notification",
		description: "Permanently delete a notification.",
		request: {
			params: z.object({
				id: z.string().min(1, "Notification ID is required"),
			}),
		},
		responses: {
			"200": {
				description: "Notification deleted successfully",
				...contentJson(SuccessDeleteResponse),
			},
			"401": {
				description: "Missing or invalid authentication",
				...contentJson(ErrorResponseSchema),
			},
			"404": {
				description: "Notification not found",
				...contentJson(ErrorResponseSchema),
			},
			"500": {
				description: "Internal server error",
				...contentJson(ErrorResponseSchema),
			},
		},
	};

	async handle(c: NotificationContext) {
		return deleteNotification(c);
	}
}

export class GetUnreadCountEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["Notifications"],
		summary: "Get unread notification count",
		description: "Get the count of unread notifications for the current user.",
		responses: {
			"200": {
				description: "Unread count returned",
				...contentJson(SuccessUnreadCountResponse),
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

	async handle(c: NotificationContext) {
		return getUnreadCount(c);
	}
}
