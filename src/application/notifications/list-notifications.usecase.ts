import type {
	NotificationFilters,
	NotificationListResult,
	NotificationRepository,
} from "../../domain/repositories/notification.repository";

/**
 * Use case for listing notifications for a user.
 * Returns paginated list with unread count.
 */
export class ListNotificationsUseCase {
	constructor(private notificationRepository: NotificationRepository) {}

	/**
	 * Execute notification listing.
	 * @param userId - The authenticated user ID
	 * @param filters - Filter options
	 * @returns Object containing data array, total count, and unread count
	 */
	async execute(
		userId: string,
		filters: NotificationFilters,
	): Promise<NotificationListResult> {
		return this.notificationRepository.findAll(userId, filters);
	}
}
