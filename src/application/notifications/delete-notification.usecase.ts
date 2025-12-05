import type { Notification } from "../../domain/entities/notification";
import type { NotificationRepository } from "../../domain/repositories/notification.repository";

/**
 * Use case for deleting a notification.
 */
export class DeleteNotificationUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Delete a notification.
	 * @param userId - The authenticated user ID
	 * @param notificationId - The notification ID
	 * @returns The deleted notification
	 */
	async execute(userId: string, notificationId: string): Promise<Notification> {
		return this.notificationRepository.delete(userId, notificationId);
	}
}
