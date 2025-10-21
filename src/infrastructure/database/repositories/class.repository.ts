import { and, eq } from "drizzle-orm";
import type {
	Class,
	ClassData,
	ClassListItem,
	ClassResource,
	ClassUpdateData,
	ClassWithResources,
} from "../../../domain/entities/class";
import type { ClassRepository } from "../../../domain/repositories/class.repository";
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

	async findBySubjectIdAndUserId(
		userId: string,
		subjectId: string,
	): Promise<ClassListItem[]> {
		const results = await this.db
			.select({
				id: classes.id,
				subjectId: classes.subjectId,
				title: classes.title,
				startDate: classes.startDate,
				endDate: classes.endDate,
				link: classes.link,
				createdAt: classes.createdAt,
				updatedAt: classes.updatedAt,
			})
			.from(classes)
			.where(
				and(
					eq(classes.userId, userId),
					eq(classes.subjectId, subjectId),
					eq(classes.isDeleted, 0),
				),
			)
			.all();

		return results;
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
				content: data.content ?? null,
				summary: data.summary ?? null,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
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
		if (data.content !== undefined) {
			updatePayload.content = data.content;
		}
		if (data.summary !== undefined) {
			updatePayload.summary = data.summary;
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

		// Soft delete the class
		await this.db
			.update(classes)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.run();

		// Return the updated class
		const deleted = await this.db
			.select()
			.from(classes)
			.where(and(eq(classes.id, classId), eq(classes.userId, userId)))
			.get();

		if (!deleted) {
			throw new Error("Failed to retrieve soft deleted class");
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
