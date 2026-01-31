import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	like,
	lte,
} from "drizzle-orm";
import slugify from "slugify";
import type {
	Class,
	ClassData,
	ClassResource,
	ClassUpdateData,
	ClassWithResources,
} from "../../../domain/entities/class";
import type {
	ClassFilters,
	ClassListResult,
	ClassRepository,
} from "../../../domain/repositories/class.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { classes, classResources, userFiles } from "../schema";

/**
 * D1 implementation of the ClassRepository interface.
 * Handles all class persistence operations using Drizzle ORM.
 * @class D1ClassRepository
 */
export class D1ClassRepository implements ClassRepository {
	constructor(private db: Database) {}

	async findAll(
		userId: string,
		filters: ClassFilters,
	): Promise<ClassListResult> {
		const conditions = [eq(classes.userId, userId), eq(classes.isDeleted, 0)];

		if (filters.subjectId) {
			conditions.push(eq(classes.subjectId, filters.subjectId));
		}

		if (filters.status && filters.status.length > 0) {
			conditions.push(inArray(classes.status, filters.status));
		}

		if (filters.aiStatus && filters.aiStatus.length > 0) {
			conditions.push(inArray(classes.aiStatus, filters.aiStatus));
		}

		if (typeof filters.isProcessed === "boolean") {
			conditions.push(eq(classes.isProcessed, filters.isProcessed ? 1 : 0));
		}

		if (filters.search) {
			conditions.push(like(classes.title, `%${filters.search}%`));
		}

		if (filters.startDateFrom) {
			conditions.push(gte(classes.startDate, filters.startDateFrom));
		}

		if (filters.startDateTo) {
			conditions.push(lte(classes.startDate, filters.startDateTo));
		}

		if (filters.endDateFrom) {
			conditions.push(gte(classes.endDate, filters.endDateFrom));
		}

		if (filters.endDateTo) {
			conditions.push(lte(classes.endDate, filters.endDateTo));
		}

		const whereClause = and(...conditions);

		const totalResult = await this.db
			.select({ count: count() })
			.from(classes)
			.where(whereClause)
			.get();

		const total = totalResult?.count ?? 0;

		const sortMap = {
			startDate: classes.startDate,
			createdAt: classes.createdAt,
			status: classes.status,
		} as const;

		let query = this.db
			.select({
				id: classes.id,
				subjectId: classes.subjectId,
				title: classes.title,
				startDate: classes.startDate,
				endDate: classes.endDate,
				link: classes.link,
				meetingLink: classes.meetingLink,
				status: classes.status,
				aiStatus: classes.aiStatus,
				topics: classes.topics,
				durationSeconds: classes.durationSeconds,
				roomLocation: classes.roomLocation,
				isProcessed: classes.isProcessed,
				createdAt: classes.createdAt,
				updatedAt: classes.updatedAt,
				slug: classes.slug,
			})
			.from(classes)
			.where(whereClause)
			.$dynamic();

		const sortColumn = filters.sortBy ? sortMap[filters.sortBy] : undefined;
		if (sortColumn) {
			query =
				filters.sortOrder === "asc"
					? query.orderBy(asc(sortColumn))
					: query.orderBy(desc(sortColumn));
		} else {
			query = query.orderBy(desc(classes.createdAt));
		}

		if (filters.limit) {
			query = query.limit(filters.limit);
		}
		if (filters.offset) {
			query = query.offset(filters.offset);
		}

		const data = await query;

		return { data, total };
	}

	async findByIdAndUserId(
		userId: string,
		classId: string,
	): Promise<ClassWithResources | null> {
		// Get the class
		const classItem = await this.db
			.select()
			.from(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.get();

		if (!classItem) {
			return null;
		}

		// Get associated resources using JOIN
		const resources = await this.db
			.select({
				id: userFiles.id,
				originalFilename: userFiles.originalFilename,
				mimeType: userFiles.mimeType,
				sizeBytes: userFiles.sizeBytes,
				associationType: classResources.associationType,
			})
			.from(classResources)
			.leftJoin(userFiles, eq(classResources.fileId, userFiles.id))
			.where(
				and(eq(classResources.classId, classId), eq(userFiles.userId, userId)),
			)
			.all();

		const classResourcesToReturn: ClassResource[] = resources
			.filter((r): r is Exclude<typeof r, { id: null }> => r.id !== null)
			.map((resource) => ({
				id: resource.id,
				originalFilename: resource.originalFilename,
				mimeType: resource.mimeType,
				sizeBytes: resource.sizeBytes,
				associationType: resource.associationType,
			}));

		return {
			...classItem,
			resources: classResourcesToReturn,
		};
	}

	async create(userId: string, data: ClassData): Promise<Class> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newClass = await this.db
			.insert(classes)
			.values({
				id,
				userId,
				subjectId: data.subjectId,
				title: data.title ?? null,
				startDate: data.startDate ?? null,
				endDate: data.endDate ?? null,
				link: data.link ?? null,
				meetingLink: data.meetingLink ?? null,
				status: data.status ?? "completed",
				aiStatus: data.aiStatus ?? "none",
				topics: data.topics ?? null,
				durationSeconds: data.durationSeconds ?? 0,
				content: data.content ?? null,
				summary: data.summary ?? null,
				transcriptionText: data.transcriptionText ?? null,
				roomLocation: data.roomLocation ?? null,
				isProcessed: data.isProcessed ?? 0,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
				slug: slugify(data.title || "class", { lower: true }),
			})
			.returning()
			.get();

		if (!newClass) {
			throw new Error("Failed to create class");
		}

		return newClass;
	}

	async update(
		userId: string,
		classId: string,
		data: ClassUpdateData,
	): Promise<Class> {
		// Verify class exists and belongs to user
		const existing = await this.db
			.select()
			.from(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Class not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = {
			updatedAt: now,
		};

		if (data.title !== undefined) {
			updatePayload.title = data.title;
			updatePayload.slug = slugify(data.title || "class", { lower: true });
		}
		if (data.startDate !== undefined) {
			updatePayload.startDate = data.startDate;
		}
		if (data.endDate !== undefined) {
			updatePayload.endDate = data.endDate;
		}
		if (data.link !== undefined) {
			updatePayload.link = data.link;
		}
		if (data.meetingLink !== undefined) {
			updatePayload.meetingLink = data.meetingLink;
		}
		if (data.status !== undefined) {
			updatePayload.status = data.status;
		}
		if (data.aiStatus !== undefined) {
			updatePayload.aiStatus = data.aiStatus;
		}
		if (data.topics !== undefined) {
			updatePayload.topics = data.topics;
		}
		if (data.durationSeconds !== undefined) {
			updatePayload.durationSeconds = data.durationSeconds;
		}
		if (data.content !== undefined) {
			updatePayload.content = data.content;
		}
		if (data.summary !== undefined) {
			updatePayload.summary = data.summary;
		}
		if (data.transcriptionText !== undefined) {
			updatePayload.transcriptionText = data.transcriptionText;
		}
		if (data.roomLocation !== undefined) {
			updatePayload.roomLocation = data.roomLocation;
		}
		if (data.isProcessed !== undefined) {
			updatePayload.isProcessed = data.isProcessed;
		}

		const updated = await this.db
			.update(classes)
			.set(updatePayload)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update class");
		}

		return updated;
	}

	async softDelete(userId: string, classId: string): Promise<Class> {
		// Verify class exists and belongs to user
		const existing = await this.db
			.select()
			.from(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Class not found");
		}

		const now = new Date().toISOString();

		// Soft delete the class and return updated record in single query
		const deleted = await this.db
			.update(classes)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.returning()
			.get();

		if (!deleted) {
			throw new Error("Failed to soft delete class");
		}

		return deleted;
	}

	async hardDelete(userId: string, classId: string): Promise<Class> {
		// Verify class exists and belongs to user
		const existing = await this.db
			.select()
			.from(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Class not found");
		}

		// Hard delete the class (cascades via foreign keys in schema)
		await this.db
			.delete(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.run();

		return existing;
	}
}
