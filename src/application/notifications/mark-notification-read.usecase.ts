import type { Notification } from "../../domain/entities/notification";
import type { NotificationRepository } from "../../domain/repositories/notification.repository";

/**
 * Use case for marking a notification as read.
 */
export class MarkNotificationReadUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Mark a notification as read.
	 * @param userId - The authenticated user ID
	 * @param notificationId - The notification ID
	 * @returns The updated notification
	 */
	async execute(userId: string, notificationId: string): Promise<Notification> {
		const now = new Date().toISOString();
		return this.notificationRepository.update(userId, notificationId, {
			isRead: 1,
			readAt: now,
		});
	}
}
