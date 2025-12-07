import { and, desc, eq } from "drizzle-orm";
import type {
	CreateScribeProjectData,
	ScribeProject,
	UpdateScribeProjectData,
} from "../../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../../domain/repositories/scribe-project.repository";
import { NotFoundError } from "../../../interfaces/http/middleware/error-handler";
import type { Database } from "../client";
import { scribeProjects } from "../schema";

/**
 * D1 implementation of the ScribeProjectRepository interface.
 * Handles all scribe project persistence operations using Drizzle ORM.
 */
export class D1ScribeProjectRepository implements ScribeProjectRepository {
	constructor(private db: Database) {}

	async findById(
		userId: string,
		projectId: string,
	): Promise<ScribeProject | null> {
		const project = await this.db
			.select()
			.from(scribeProjects)
			.where(
				and(
					eq(scribeProjects.id, projectId),
					eq(scribeProjects.userId, userId),
				),
			)
			.get();

		return project ?? null;
	}

	async listByUserId(userId: string): Promise<ScribeProject[]> {
		const projects = await this.db
			.select()
			.from(scribeProjects)
			.where(eq(scribeProjects.userId, userId))
			.orderBy(desc(scribeProjects.createdAt))
			.all();

		return projects;
	}

	async create(data: CreateScribeProjectData): Promise<ScribeProject> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		const newProject = await this.db
			.insert(scribeProjects)
			.values({
				id,
				userId: data.userId,
				taskId: data.taskId ?? null,
				subjectId: data.subjectId ?? null,
				templateId: data.templateId ?? "apa",
				title: data.title ?? "Untitled Draft",
				status: "draft",
				rubricContent: data.rubricContent ?? null,
				rubricFileUrl: data.rubricFileUrl ?? null,
				rubricMimeType: data.rubricMimeType ?? null,
				formQuestions: null,
				userAnswers: null,
				contentMarkdown: null,
				currentTypstJson: null,
				reviewFeedback: null,
				workflowId: null,
				finalPdfFileId: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		if (!newProject) {
			throw new Error("Failed to create scribe project");
		}

		return newProject;
	}

	async update(
		userId: string,
		projectId: string,
		data: UpdateScribeProjectData,
	): Promise<ScribeProject> {
		const existing = await this.findById(userId, projectId);
		if (!existing) {
			throw new NotFoundError("Scribe project not found");
		}

		const now = new Date().toISOString();
		const updatePayload: Record<string, unknown> = {
			updatedAt: now,
		};

		if (data.title !== undefined) updatePayload.title = data.title;
		if (data.status !== undefined) updatePayload.status = data.status;
		if (data.rubricContent !== undefined)
			updatePayload.rubricContent = data.rubricContent;
		if (data.rubricFileUrl !== undefined)
			updatePayload.rubricFileUrl = data.rubricFileUrl;
		if (data.rubricMimeType !== undefined)
			updatePayload.rubricMimeType = data.rubricMimeType;
		if (data.formQuestions !== undefined)
			updatePayload.formQuestions = data.formQuestions;
		if (data.userAnswers !== undefined)
			updatePayload.userAnswers = data.userAnswers;
		if (data.contentMarkdown !== undefined)
			updatePayload.contentMarkdown = data.contentMarkdown;
		if (data.currentTypstJson !== undefined)
			updatePayload.currentTypstJson = data.currentTypstJson;
		if (data.reviewFeedback !== undefined)
			updatePayload.reviewFeedback = data.reviewFeedback;
		if (data.workflowId !== undefined)
			updatePayload.workflowId = data.workflowId;
		if (data.finalPdfFileId !== undefined)
			updatePayload.finalPdfFileId = data.finalPdfFileId;
		if (data.finalPdfUrl !== undefined)
			updatePayload.finalPdfUrl = data.finalPdfUrl;

		const updated = await this.db
			.update(scribeProjects)
			.set(updatePayload)
			.where(
				and(
					eq(scribeProjects.id, projectId),
					eq(scribeProjects.userId, userId),
				),
			)
			.returning()
			.get();

		if (!updated) {
			throw new NotFoundError("Failed to update scribe project");
		}

		return updated;
	}

	async delete(userId: string, projectId: string): Promise<void> {
		const existing = await this.findById(userId, projectId);
		if (!existing) {
			throw new NotFoundError("Scribe project not found");
		}

		await this.db
			.delete(scribeProjects)
			.where(
				and(
					eq(scribeProjects.id, projectId),
					eq(scribeProjects.userId, userId),
				),
			)
			.run();
	}
}
