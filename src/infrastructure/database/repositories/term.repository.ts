import { and, eq } from "drizzle-orm";
import type {
	Term,
	TermData,
	TermUpdateData,
} from "../../../domain/entities/term";
import type { TermRepository } from "../../../domain/repositories/term.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { subjects, terms } from "../schema";

export class D1TermRepository implements TermRepository {
	constructor(private db: Database) {}

	async findByUserId(userId: string): Promise<Term[]> {
		const results = await this.db
			.select()
			.from(terms)
			.where(and(eq(terms.userId, userId), eq(terms.isDeleted, 0)))
			.orderBy(terms.order)
			.all();

		return results;
	}

	async findByIdAndUserId(
		userId: string,
		termId: string,
	): Promise<Term | null> {
		const result = await this.db
			.select()
			.from(terms)
			.where(and(eq(terms.id, termId), eq(terms.userId, userId)))
			.get();

		return result || null;
	}

	async create(userId: string, data: TermData): Promise<Term> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newTerm = await this.db
			.insert(terms)
			.values({
				id,
				userId,
				name: data.name,
				order: data.order,
				isDeleted: 0,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!newTerm) {
			throw new Error("Failed to create term");
		}

		return newTerm;
	}

	async update(
		userId: string,
		termId: string,
		data: TermUpdateData,
	): Promise<Term> {
		// Verify term exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, termId);
		if (!existing) {
			throw new NotFoundError("Term not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = {
			updatedAt: now,
		};

		if (data.name !== undefined) {
			updatePayload.name = data.name;
		}

		if (data.order !== undefined) {
			updatePayload.order = data.order;
		}

		const updated = await this.db
			.update(terms)
			.set(updatePayload)
			.where(and(eq(terms.id, termId), eq(terms.userId, userId)))
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update term");
		}

		return updated;
	}

	async softDelete(userId: string, termId: string): Promise<Term> {
		// Verify term exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, termId);
		if (!existing) {
			throw new NotFoundError("Term not found");
		}

		const now = new Date().toISOString();

		// Soft delete the term
		await this.db
			.update(terms)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(terms.id, termId), eq(terms.userId, userId)))
			.run();

		// Cascade: soft delete all subjects related to this term
		await this.db
			.update(subjects)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(and(eq(subjects.termId, termId), eq(subjects.userId, userId)))
			.run();

		// Return the updated term
		const deleted = await this.findByIdAndUserId(userId, termId);
		if (!deleted) {
			throw new Error("Failed to retrieve soft deleted term");
		}

		return deleted;
	}

	async hardDelete(userId: string, termId: string): Promise<Term> {
		// Verify term exists and belongs to user
		const existing = await this.findByIdAndUserId(userId, termId);
		if (!existing) {
			throw new NotFoundError("Term not found");
		}

		// Hard delete the term (cascades via foreign keys in schema)
		await this.db
			.delete(terms)
			.where(and(eq(terms.id, termId), eq(terms.userId, userId)))
			.run();

		return existing;
	}
}
