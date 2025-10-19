import { and, eq } from "drizzle-orm";
import type {
	Task,
	TaskData,
	TaskListItem,
	TaskResource,
	TaskUpdateData,
	TaskWithResources,
} from "../../../domain/entities/task";
import type { TaskRepository } from "../../../domain/repositories/task.repository";
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

		// Soft delete the task
		await this.db
			.update(tasks)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.run();

		// Return the updated task
		const deleted = await this.db
			.select()
			.from(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
			.get();

		if (!deleted) {
			throw new Error("Failed to retrieve soft deleted task");
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
