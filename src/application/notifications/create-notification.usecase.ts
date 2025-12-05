import type {
	Notification,
	NotificationData,
} from "../../domain/entities/notification";
import type { NotificationRepository } from "../../domain/repositories/notification.repository";

/**
 * Use case for creating a new notification.
 */
export class CreateNotificationUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Execute notification creation.
	 * @param data - Notification data
	 * @returns The created notification
	 */
	async execute(data: NotificationData): Promise<Notification> {
		return this.notificationRepository.create(data);
	}
}
