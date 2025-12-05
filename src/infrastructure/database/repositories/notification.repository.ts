import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type {
	Notification,
	NotificationData,
	NotificationUpdateData,
} from "../../../domain/entities/notification";
import type {
	NotificationFilters,
	NotificationListResult,
	NotificationRepository,
} from "../../../domain/repositories/notification.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { notifications } from "../schema";

/**
 * D1 implementation of the NotificationRepository interface.
 * Handles all notification persistence operations using Drizzle ORM.
 */
export class D1NotificationRepository implements NotificationRepository {
	constructor(private db: Database) {}

	async findAll(
		userId: string,
		filters: NotificationFilters,
	): Promise<NotificationListResult> {
		const conditions = [eq(notifications.userId, userId)];

		if (filters.type && filters.type.length > 0) {
			conditions.push(inArray(notifications.type, filters.type));
		}

		if (typeof filters.isRead === "boolean") {
			conditions.push(eq(notifications.isRead, filters.isRead ? 1 : 0));
		}

		const whereClause = and(...conditions);

		// Get total count
		const totalResult = await this.db
			.select({ count: count() })
			.from(notifications)
			.where(whereClause)
			.get();

		const total = totalResult?.count ?? 0;

		// Get unread count
		const unreadResult = await this.db
			.select({ count: count() })
			.from(notifications)
			.where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)))
			.get();

		const unreadCount = unreadResult?.count ?? 0;

		// Build query with sorting and pagination
		let query = this.db
			.select({
				id: notifications.id,
				type: notifications.type,
				payload: notifications.payload,
				isRead: notifications.isRead,
				actionUrl: notifications.actionUrl,
				createdAt: notifications.createdAt,
			})
			.from(notifications)
			.where(whereClause)
			.$dynamic();

		// Sort by createdAt (newest first by default)
		query =
			filters.sortOrder === "asc"
				? query.orderBy(asc(notifications.createdAt))
				: query.orderBy(desc(notifications.createdAt));

		if (filters.limit) {
			query = query.limit(filters.limit);
		}
		if (filters.offset) {
			query = query.offset(filters.offset);
		}

		const data = await query;

		return {
			data: data.map((item) => ({
				...item,
				payload: (item.payload ?? {}) as Record<string, unknown>,
			})),
			total,
			unreadCount,
		};
	}

	async findByIdAndUserId(
		userId: string,
		notificationId: string,
	): Promise<Notification | null> {
		const notification = await this.db
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.id, notificationId),
					eq(notifications.userId, userId),
				),
			)
			.get();

		if (!notification) {
			return null;
		}

		return {
			...notification,
			payload: (notification.payload ?? {}) as Record<string, unknown>,
		};
	}

	async create(data: NotificationData): Promise<Notification> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newNotification = await this.db
			.insert(notifications)
			.values({
				id,
				userId: data.userId,
				type: data.type,
				payload: data.payload,
				isRead: 0,
				readAt: null,
				actionUrl: data.actionUrl ?? null,
				createdAt: now,
			})
			.returning()
			.get();

		if (!newNotification) {
			throw new Error("Failed to create notification");
		}

		return {
			...newNotification,
			payload: (newNotification.payload ?? {}) as Record<string, unknown>,
		};
	}

	async update(
		userId: string,
		notificationId: string,
		data: NotificationUpdateData,
	): Promise<Notification> {
		const existing = await this.db
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.id, notificationId),
					eq(notifications.userId, userId),
				),
			)
			.get();

		if (!existing) {
			throw new NotFoundError("Notification not found");
		}

		const updatePayload: Record<string, unknown> = {};

		if (data.isRead !== undefined) {
			updatePayload.isRead = data.isRead;
		}
		if (data.readAt !== undefined) {
			updatePayload.readAt = data.readAt;
		}

		const updated = await this.db
			.update(notifications)
			.set(updatePayload)
			.where(
				and(
					eq(notifications.id, notificationId),
					eq(notifications.userId, userId),
				),
			)
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update notification");
		}

		return {
			...updated,
			payload: (updated.payload ?? {}) as Record<string, unknown>,
		};
	}

	async markAllAsRead(userId: string): Promise<number> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(notifications)
			.set({ isRead: 1, readAt: now })
			.where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)))
			.returning();

		return result.length;
	}

	async delete(userId: string, notificationId: string): Promise<Notification> {
		const existing = await this.db
			.select()
			.from(notifications)
			.where(
				and(
					eq(notifications.id, notificationId),
					eq(notifications.userId, userId),
				),
			)
			.get();

		if (!existing) {
			throw new NotFoundError("Notification not found");
		}

		await this.db
			.delete(notifications)
			.where(
				and(
					eq(notifications.id, notificationId),
					eq(notifications.userId, userId),
				),
			)
			.run();

		return {
			...existing,
			payload: (existing.payload ?? {}) as Record<string, unknown>,
		};
	}

	async getUnreadCount(userId: string): Promise<number> {
		const result = await this.db
			.select({ count: count() })
			.from(notifications)
			.where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)))
			.get();

		return result?.count ?? 0;
	}
}
