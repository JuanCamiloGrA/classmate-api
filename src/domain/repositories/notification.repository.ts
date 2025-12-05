import type {
	Notification,
	NotificationData,
	NotificationListItem,
	NotificationType,
	NotificationUpdateData,
} from "../entities/notification";

export interface NotificationFilters {
	type?: NotificationType[];
	isRead?: boolean;
	limit?: number;
	offset?: number;
	sortOrder?: "asc" | "desc";
}

export interface NotificationListResult {
	data: NotificationListItem[];
	total: number;
	unreadCount: number;
}

/**
 * Repository interface for notification persistence operations.
 * Defines the contract for notification data access.
 * @interface NotificationRepository
 */
export interface NotificationRepository {
	/**
	 * List notifications with filtering and pagination.
	 * @param userId - The user ID (ownership check)
	 * @param filters - Filter options
	 * @returns Object containing data array, total count, and unread count
	 */
	findAll(
		userId: string,
		filters: NotificationFilters,
	): Promise<NotificationListResult>;

	/**
	 * Retrieve a single notification by ID.
	 * @param userId - The user ID (ownership check)
	 * @param notificationId - The notification ID
	 * @returns The notification if found and belongs to user, null otherwise
	 */
	findByIdAndUserId(
		userId: string,
		notificationId: string,
	): Promise<Notification | null>;

	/**
	 * Create a new notification.
	 * @param data - Notification data to persist
	 * @returns The created notification
	 */
	create(data: NotificationData): Promise<Notification>;

	/**
	 * Update a notification (mark as read).
	 * @param userId - The user ID (ownership check)
	 * @param notificationId - The notification ID
	 * @param data - Update data
	 * @returns The updated notification
	 * @throws NotFoundError if notification not found
	 */
	update(
		userId: string,
		notificationId: string,
		data: NotificationUpdateData,
	): Promise<Notification>;

	/**
	 * Mark all notifications as read for a user.
	 * @param userId - The user ID
	 * @returns Number of notifications marked as read
	 */
	markAllAsRead(userId: string): Promise<number>;

	/**
	 * Delete a notification permanently.
	 * @param userId - The user ID (ownership check)
	 * @param notificationId - The notification ID
	 * @returns The deleted notification
	 * @throws NotFoundError if notification not found
	 */
	delete(userId: string, notificationId: string): Promise<Notification>;

	/**
	 * Get unread notification count for a user.
	 * @param userId - The user ID
	 * @returns Number of unread notifications
	 */
	getUnreadCount(userId: string): Promise<number>;
}
