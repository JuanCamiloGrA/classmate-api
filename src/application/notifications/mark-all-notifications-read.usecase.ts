import type { NotificationRepository } from "../../domain/repositories/notification.repository";

/**
 * Use case for marking all notifications as read.
 */
export class MarkAllNotificationsReadUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Mark all notifications as read for a user.
	 * @param userId - The authenticated user ID
	 * @returns Number of notifications marked as read
	 */
	async execute(userId: string): Promise<number> {
		return this.notificationRepository.markAllAsRead(userId);
	}
}
