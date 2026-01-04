import { and, eq } from "drizzle-orm";
import type {
	Subject,
	SubjectData,
	SubjectUpdateData,
} from "../../../domain/entities/subject";
import type { SubjectRepository } from "../../../domain/repositories/subject.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { classes, subjects, tasks } from "../schema";

/**
 * D1 implementation of the SubjectRepository interface.
 * Handles all subject persistence operations using Drizzle ORM.
 * @class D1SubjectRepository
 */
export class D1SubjectRepository implements SubjectRepository {
	constructor(private db: Database) {}

	async findByTermIdAndUserId(
		userId: string,
		termId: string,
	): Promise<Subject[]> {
		const results = await this.db
			.select()
			.from(subjects)
			.where(
				and(
					eq(subjects.userId, userId),
					eq(subjects.termId, termId),
					eq(subjects.isDeleted, 0),
				),
			)
			.all();

		return results;
	}

	async findByIdAndUserId(
		userId: string,
		subjectId: string,
	): Promise<Subject | null> {
		const result = await this.db
			.select()
			.from(subjects)
			.where(
				and(
					eq(subjects.id, subjectId),
					eq(subjects.userId, userId),
					eq(subjects.isDeleted, 0),
				),
			)
			.get();

		return result || null;
	}

	async create(userId: string, data: SubjectData): Promise<Subject> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newSubject = await this.db
			.insert(subjects)
			.values({
				id,
				userId,
				termId: data.termId,
				name: data.name,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!newSubject) {
			throw new Error("Failed to create subject");
		}

		return newSubject;
	}

	async update(
		userId: string,
		subjectId: string,
		data: SubjectUpdateData,
	): Promise<Subject> {
		// Verify subject exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, subjectId);
		if (!existing) {
			throw new NotFoundError("Subject not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = {
			updatedAt: now,
		};

		if (data.name !== undefined) {
			updatePayload.name = data.name;
		}

		if (data.termId !== undefined) {
			updatePayload.termId = data.termId;
		}

		if (data.professor !== undefined) {
			updatePayload.professor = data.professor;
		}

		if (data.credits !== undefined) {
			updatePayload.credits = data.credits;
		}

		if (data.location !== undefined) {
			updatePayload.location = data.location;
		}

		if (data.scheduleText !== undefined) {
			updatePayload.scheduleText = data.scheduleText;
		}

		if (data.syllabusUrl !== undefined) {
			updatePayload.syllabusUrl = data.syllabusUrl;
		}

		if (data.colorTheme !== undefined) {
			updatePayload.colorTheme = data.colorTheme;
		}

		const updated = await this.db
			.update(subjects)
			.set(updatePayload)
			.where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update subject");
		}

		return updated;
	}

	async softDelete(userId: string, subjectId: string): Promise<Subject> {
		// Verify subject exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, subjectId);
		if (!existing) {
			throw new NotFoundError("Subject not found");
		}

		const now = new Date().toISOString();

		// Soft delete the subject
		await this.db
			.update(subjects)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
			.run();

		// Cascade: soft delete all tasks related to this subject
		await this.db
			.update(tasks)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(tasks.subjectId, subjectId), eq(tasks.userId, userId)))
			.run();

		// Cascade: soft delete all classes related to this subject
		await this.db
			.update(classes)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(classes.subjectId, subjectId), eq(classes.userId, userId)))
			.run();

		// Return the updated subject
		const deleted = await this.findByIdAndUserId(userId, subjectId);
		if (!deleted) {
			throw new Error("Failed to retrieve soft deleted subject");
		}

		return deleted;
	}

	async hardDelete(userId: string, subjectId: string): Promise<Subject> {
		// Verify subject exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, subjectId);
		if (!existing) {
			throw new NotFoundError("Subject not found");
		}

		// Hard delete the subject (cascades via foreign keys in schema)
		await this.db
			.delete(subjects)
			.where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
			.run();

		return existing;
	}
}
