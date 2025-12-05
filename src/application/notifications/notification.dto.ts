import type {
	Notification,
	NotificationListItem,
	NotificationType,
} from "../../domain/entities/notification";

/**
 * Data Transfer Object for notification list response
 */
export interface NotificationListDTO {
	id: string;
	type: NotificationType;
	payload: Record<string, unknown>;
	is_read: number;
	action_url: string | null;
	created_at: string;
}

/**
 * Data Transfer Object for notification detail response
 */
export interface NotificationDetailDTO {
	id: string;
	user_id: string;
	type: NotificationType;
	payload: Record<string, unknown>;
	is_read: number;
	read_at: string | null;
	action_url: string | null;
	created_at: string;
}

/**
 * Convert NotificationListItem to NotificationListDTO
 */
export function toNotificationListDTO(
	item: NotificationListItem,
): NotificationListDTO {
	return {
		id: item.id,
		type: item.type,
		payload: item.payload,
		is_read: item.isRead,
		action_url: item.actionUrl,
		created_at: item.createdAt,
	};
}

/**
 * Convert Notification to NotificationDetailDTO
 */
export function toNotificationDetailDTO(
	item: Notification,
): NotificationDetailDTO {
	return {
		id: item.id,
		user_id: item.userId,
		type: item.type,
		payload: item.payload,
		is_read: item.isRead,
		read_at: item.readAt,
		action_url: item.actionUrl,
		created_at: item.createdAt,
	};
}
