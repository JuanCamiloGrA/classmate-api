/**
 * Notification types that determine which component renders the notification.
 */
export type NotificationType =
	| "class_summary_ready"
	| "task_due_soon"
	| "grade_posted"
	| "system_alert";

/**
 * Represents a user notification in the system.
 * @interface Notification
 */
export interface Notification {
	/** Unique identifier */
	id: string;
	/** User ID who owns this notification */
	userId: string;
	/** Type of notification (determines widget rendering) */
	type: NotificationType;
	/** Dynamic payload data for the widget (JSON) */
	payload: Record<string, unknown>;
	/** Read status flag (1 = read, 0 = unread) */
	isRead: number;
	/** ISO 8601 timestamp when notification was read, null if unread */
	readAt: string | null;
	/** Optional action URL for generic click behavior */
	actionUrl: string | null;
	/** ISO 8601 timestamp of notification creation */
	createdAt: string;
}

/**
 * Input data for creating a new notification.
 * @interface NotificationData
 */
export interface NotificationData {
	/** User ID to receive the notification */
	userId: string;
	/** Type of notification */
	type: NotificationType;
	/** Payload data for the widget */
	payload: Record<string, unknown>;
	/** Optional action URL */
	actionUrl?: string | null;
}

/**
 * Input data for updating a notification (limited to read status).
 * @interface NotificationUpdateData
 */
export interface NotificationUpdateData {
	/** Read status */
	isRead?: number;
	/** Timestamp when read */
	readAt?: string | null;
}

/**
 * Optimized notification for list response.
 * @interface NotificationListItem
 */
export interface NotificationListItem {
	/** Unique identifier */
	id: string;
	/** Type of notification */
	type: NotificationType;
	/** Payload data */
	payload: Record<string, unknown>;
	/** Read status */
	isRead: number;
	/** Action URL */
	actionUrl: string | null;
	/** Creation timestamp */
	createdAt: string;
}
