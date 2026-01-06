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
import type {
	Task,
	TaskData,
	TaskListItem,
	TaskResource,
	TaskUpdateData,
	TaskWithResources,
} from "../../../domain/entities/task";
import type {
	TaskFilters,
	TaskListResult,
	TaskRepository,
} from "../../../domain/repositories/task.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { taskResources, tasks, userFiles } from "../schema";

/**
 * D1 implementation of the TaskRepository interface.
 * Handles all task persistence operations using Drizzle ORM.
 * @class D1TaskRepository
 */
export class D1TaskRepository implements TaskRepository {
	constructor(private db: Database) {}

	async findAll(userId: string, filters: TaskFilters): Promise<TaskListResult> {
		const conditions = [eq(tasks.userId, userId), eq(tasks.isDeleted, 0)];

		if (filters.subjectId) {
			conditions.push(eq(tasks.subjectId, filters.subjectId));
		}

		if (filters.status && filters.status.length > 0) {
			conditions.push(inArray(tasks.status, filters.status));
		}

		if (filters.priority && filters.priority.length > 0) {
			conditions.push(inArray(tasks.priority, filters.priority));
		}

		if (filters.search) {
			conditions.push(like(tasks.title, `%${filters.search}%`));
		}

		if (filters.dueDateFrom) {
			conditions.push(gte(tasks.dueDate, filters.dueDateFrom));
		}

		if (filters.dueDateTo) {
			conditions.push(lte(tasks.dueDate, filters.dueDateTo));
		}

		const whereClause = and(...conditions);

		// Get total count
		const totalResult = await this.db
			.select({ count: count() })
			.from(tasks)
			.where(whereClause)
			.get();

		const total = totalResult?.count ?? 0;

		// Get data
		let query = this.db
			.select({
				id: tasks.id,
				subjectId: tasks.subjectId,
				title: tasks.title,
				dueDate: tasks.dueDate,
				status: tasks.status,
				priority: tasks.priority,
				grade: tasks.grade,
				createdAt: tasks.createdAt,
				updatedAt: tasks.updatedAt,
			})
			.from(tasks)
			.where(whereClause)
			.$dynamic();

		// Sorting
		if (filters.sortBy) {
			const sortColumn = tasks[filters.sortBy];
			if (filters.sortOrder === "desc") {
				query = query.orderBy(desc(sortColumn));
			} else {
				query = query.orderBy(asc(sortColumn));
			}
		} else {
			// Default sort
			query = query.orderBy(desc(tasks.createdAt));
		}

		// Pagination
		if (filters.limit) {
			query = query.limit(filters.limit);
		}
		if (filters.offset) {
			query = query.offset(filters.offset);
		}

		const data = await query;

		return { data, total };
	}

	async findBySubjectIdAndUserId(
		userId: string,
		subjectId: string,
	): Promise<TaskListItem[]> {
		const results = await this.db
			.select({
				id: tasks.id,
				subjectId: tasks.subjectId,
				title: tasks.title,
				dueDate: tasks.dueDate,
				status: tasks.status,
				priority: tasks.priority,
				grade: tasks.grade,
				createdAt: tasks.createdAt,
				updatedAt: tasks.updatedAt,
			})
			.from(tasks)
			.where(
				and(
					eq(tasks.userId, userId),
					eq(tasks.subjectId, subjectId),
					eq(tasks.isDeleted, 0),
				),
			)
			.all();

		return results;
	}

	async findByIdAndUserId(
		userId: string,
		taskId: string,
	): Promise<TaskWithResources | null> {
		// Get the task
		const task = await this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.get();

		if (!task) {
			return null;
		}

		// Get associated resources using JOIN
		const resources = await this.db
			.select({
				id: userFiles.id,
				originalFilename: userFiles.originalFilename,
				mimeType: userFiles.mimeType,
				sizeBytes: userFiles.sizeBytes,
				associationType: taskResources.associationType,
			})
			.from(taskResources)
			.leftJoin(userFiles, eq(taskResources.fileId, userFiles.id))
			.where(
				and(eq(taskResources.taskId, taskId), eq(userFiles.userId, userId)),
			)
			.all();

		const taskResourcesToReturn: TaskResource[] = resources
			.filter((r): r is Exclude<typeof r, { id: null }> => r.id !== null)
			.map((resource) => ({
				id: resource.id,
				originalFilename: resource.originalFilename,
				mimeType: resource.mimeType,
				sizeBytes: resource.sizeBytes,
				associationType: resource.associationType,
			}));

		return {
			...task,
			resources: taskResourcesToReturn,
		};
	}

	async create(userId: string, data: TaskData): Promise<Task> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newTask = await this.db
			.insert(tasks)
			.values({
				id,
				userId,
				subjectId: data.subjectId,
				title: data.title,
				dueDate: data.dueDate ?? null,
				status: data.status ?? "todo",
				priority: data.priority ?? "medium",
				content: data.content ?? null,
				grade: data.grade ?? null,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!newTask) {
			throw new Error("Failed to create task");
		}

		return newTask;
	}

	async update(
		userId: string,
		taskId: string,
		data: TaskUpdateData,
	): Promise<Task> {
		// Verify task exists and belongs to user
		const existing = await this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Task not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = {
			updatedAt: now,
		};

		if (data.title !== undefined) {
			updatePayload.title = data.title;
		}
		if (data.dueDate !== undefined) {
			updatePayload.dueDate = data.dueDate;
		}
		if (data.status !== undefined) {
			updatePayload.status = data.status;
		}
		if (data.priority !== undefined) {
			updatePayload.priority = data.priority;
		}
		if (data.content !== undefined) {
			updatePayload.content = data.content;
		}
		if (data.grade !== undefined) {
			updatePayload.grade = data.grade;
		}

		const updated = await this.db
			.update(tasks)
			.set(updatePayload)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update task");
		}

		return updated;
	}

	async softDelete(userId: string, taskId: string): Promise<Task> {
		// Verify task exists and belongs to user
		const existing = await this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Task not found");
		}

		const now = new Date().toISOString();

		// Soft delete the task and return updated record in single query
		const deleted = await this.db
			.update(tasks)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.returning()
			.get();

		if (!deleted) {
			throw new Error("Failed to soft delete task");
		}

		return deleted;
	}

	async hardDelete(userId: string, taskId: string): Promise<Task> {
		// Verify task exists and belongs to user
		const existing = await this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.get();

		if (!existing) {
			throw new NotFoundError("Task not found");
		}

		// Hard delete the task (cascades via foreign keys in schema)
		await this.db
			.delete(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.run();

		return existing;
	}
}
