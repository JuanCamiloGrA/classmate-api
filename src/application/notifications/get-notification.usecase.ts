import type { Notification } from "../../domain/entities/notification";
import type { NotificationRepository } from "../../domain/repositories/notification.repository";
import { NotFoundError } from "../../interfaces/http/middleware/error-handler";

/**
 * Use case for retrieving a single notification.
 */
export class GetNotificationUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Execute notification retrieval.
	 * @param userId - The authenticated user ID
	 * @param notificationId - The notification ID
	 * @returns The notification if found
	 * @throws NotFoundError if notification not found
	 */
	async execute(userId: string, notificationId: string): Promise<Notification> {
		const notification = await this.notificationRepository.findByIdAndUserId(
			userId,
			notificationId,
		);

		if (!notification) {
			throw new NotFoundError("Notification not found");
		}

		return notification;
	}
}
