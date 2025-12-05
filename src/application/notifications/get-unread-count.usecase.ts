import type { NotificationRepository } from "../../domain/repositories/notification.repository";

/**
 * Use case for getting unread notification count.
 */
export class GetUnreadCountUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Get unread notification count for a user.
	 * @param userId - The authenticated user ID
	 * @returns Number of unread notifications
	 */
	async execute(userId: string): Promise<number> {
		return this.notificationRepository.getUnreadCount(userId);
	}
}
