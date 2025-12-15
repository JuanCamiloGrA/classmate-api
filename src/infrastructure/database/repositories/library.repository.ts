import { and, eq, like, sql } from "drizzle-orm";
import { mimeTypeToLibraryType } from "../../../application/library/library.dto";
import type {
	LibraryItem,
	LibraryItemStatus,
	PendingFileRecord,
	StorageUsage,
} from "../../../domain/entities/library";
import type {
	LibraryFilters,
	LibraryListResult,
	LibraryRepository,
} from "../../../domain/repositories/library.repository";
import type { Database } from "../client";
import {
	profiles,
	scribeProjects,
	subjects,
	taskResources,
	tasks,
	userFiles,
} from "../schema";

/**
 * D1 implementation of LibraryRepository.
 * Aggregates user_files and scribe_projects into a unified library view.
 */
export class D1LibraryRepository implements LibraryRepository {
	constructor(private db: Database) {}

	async findAll(
		userId: string,
		filters: LibraryFilters,
	): Promise<LibraryListResult> {
		const limit = filters.limit ?? 50;
		const offset = filters.offset ?? 0;

		// Build WHERE conditions for scribe_projects
		const scribeConditions = [
			eq(scribeProjects.userId, userId),
			eq(scribeProjects.isDeleted, 0),
		];

		// Build WHERE conditions for user_files
		const fileConditions = [eq(userFiles.userId, userId)];

		// Apply search filter
		if (filters.search) {
			const searchPattern = `%${filters.search}%`;
			scribeConditions.push(like(scribeProjects.title, searchPattern));
			fileConditions.push(like(userFiles.originalFilename, searchPattern));
		}

		// Apply subject filter
		if (filters.subjectId) {
			scribeConditions.push(eq(scribeProjects.subjectId, filters.subjectId));
			// user_files don't have subjectId directly, so we skip this filter for them
			// or we could join through task_resources -> tasks -> subjectId
		}

		// Query scribe projects
		const scribeQuery = this.db
			.select({
				id: scribeProjects.id,
				source: sql<string>`'scribe_project'`.as("source"),
				title: scribeProjects.title,
				mimeType: sql<string | null>`NULL`.as("mime_type"),
				docType: sql<string | null>`NULL`.as("doc_type"),
				subjectId: scribeProjects.subjectId,
				subjectName: subjects.name,
				subjectColor: subjects.colorTheme,
				date: scribeProjects.createdAt,
				sizeBytes: sql<number>`COALESCE(
          LENGTH(${scribeProjects.currentTypstJson}),
          LENGTH(${scribeProjects.formSchema}),
          LENGTH(${scribeProjects.rubricContent}),
          0
        )`.as("size_bytes"),
				status: scribeProjects.status,
				linkedTaskId: scribeProjects.taskId,
				linkedTaskTitle: tasks.title,
				r2Key: sql<string | null>`NULL`.as("r2_key"),
			})
			.from(scribeProjects)
			.leftJoin(subjects, eq(scribeProjects.subjectId, subjects.id))
			.leftJoin(tasks, eq(scribeProjects.taskId, tasks.id))
			.where(and(...scribeConditions))
			.$dynamic();

		// Query user files with LEFT JOIN to task_resources and tasks
		const filesQuery = this.db
			.select({
				id: userFiles.id,
				source: sql<string>`'user_file'`.as("source"),
				title: userFiles.originalFilename,
				mimeType: userFiles.mimeType,
				docType: userFiles.docType,
				subjectId: sql<string | null>`NULL`.as("subject_id"),
				subjectName: sql<string | null>`NULL`.as("subject_name"),
				subjectColor: sql<string | null>`NULL`.as("subject_color"),
				date: userFiles.createdAt,
				sizeBytes: userFiles.sizeBytes,
				status: sql<string>`'final'`.as("status"),
				linkedTaskId: taskResources.taskId,
				linkedTaskTitle: tasks.title,
				r2Key: userFiles.r2Key,
			})
			.from(userFiles)
			.leftJoin(taskResources, eq(userFiles.id, taskResources.fileId))
			.leftJoin(tasks, eq(taskResources.taskId, tasks.id))
			.where(and(...fileConditions))
			.$dynamic();

		// Execute both queries
		const [scribeResults, fileResults] = await Promise.all([
			scribeQuery,
			filesQuery,
		]);

		// Combine and filter by type
		type RawItem = {
			id: string;
			source: string;
			title: string;
			mimeType: string | null;
			docType: string | null;
			subjectId: string | null;
			subjectName: string | null;
			subjectColor: string | null;
			date: string;
			sizeBytes: number | null;
			status: string;
			linkedTaskId: string | null;
			linkedTaskTitle: string | null;
			r2Key: string | null;
		};

		let combined: RawItem[] = [
			...scribeResults.map((r) => ({
				...r,
				title: r.title ?? "Untitled Draft",
			})),
			...fileResults.map((r) => ({
				...r,
				title: r.title ?? "Unknown File",
			})),
		];

		// Apply type filter
		if (filters.type && filters.type !== "all") {
			combined = combined.filter((item) => {
				if (item.source === "scribe_project") {
					return filters.type === "scribe_doc";
				}
				const itemType = mimeTypeToLibraryType(
					item.mimeType ?? "",
					item.docType,
				);
				return itemType === filters.type;
			});
		}

		// Sort
		const sortOrder = filters.sortOrder ?? "desc";
		const sortBy = filters.sortBy ?? "date";

		combined.sort((a, b) => {
			if (sortBy === "name") {
				const comparison = a.title.localeCompare(b.title);
				return sortOrder === "asc" ? comparison : -comparison;
			}
			// Default: date
			const dateA = new Date(a.date).getTime();
			const dateB = new Date(b.date).getTime();
			return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
		});

		const total = combined.length;

		// Apply pagination
		const paginated = combined.slice(offset, offset + limit);

		// Transform to LibraryItem
		const data: LibraryItem[] = paginated.map((item) => ({
			id: item.id,
			source: item.source as "user_file" | "scribe_project",
			title: item.title,
			type:
				item.source === "scribe_project"
					? "scribe_doc"
					: mimeTypeToLibraryType(item.mimeType ?? "", item.docType),
			subjectId: item.subjectId,
			subjectName: item.subjectName,
			subjectColor: item.subjectColor,
			date: item.date,
			sizeBytes: item.sizeBytes,
			status: item.status as LibraryItemStatus,
			linkedTaskId: item.linkedTaskId,
			linkedTaskTitle: item.linkedTaskTitle,
			r2Key: item.r2Key,
			mimeType: item.mimeType,
		}));

		return { data, total };
	}

	async getStorageUsage(userId: string): Promise<StorageUsage | null> {
		const profile = await this.db
			.select({
				storageUsedBytes: profiles.storageUsedBytes,
				subscriptionTier: profiles.subscriptionTier,
			})
			.from(profiles)
			.where(eq(profiles.id, userId))
			.get();

		if (!profile) {
			return null;
		}

		return {
			usedBytes: profile.storageUsedBytes,
			totalBytes: 0, // Will be calculated in use case based on tier
			tier: profile.subscriptionTier as "free" | "pro" | "premium",
		};
	}

	async createPendingFile(file: PendingFileRecord): Promise<void> {
		await this.db.insert(userFiles).values({
			id: file.id,
			userId: file.userId,
			r2Key: file.r2Key,
			originalFilename: file.originalFilename,
			mimeType: file.mimeType,
			sizeBytes: file.sizeBytes,
			docType: null,
		});

		// Link to task if provided
		if (file.taskId) {
			await this.linkFileToTask(file.id, file.taskId);
		}
	}

	async confirmUpload(fileId: string, userId: string): Promise<boolean> {
		// Get the file to confirm it exists and get size
		const file = await this.getFileById(fileId, userId);

		if (!file) {
			return false;
		}

		// Update storage usage
		await this.updateStorageUsage(userId, file.sizeBytes);

		return true;
	}

	async getFileById(
		fileId: string,
		userId: string,
	): Promise<{ id: string; r2Key: string; sizeBytes: number } | null> {
		const file = await this.db
			.select({
				id: userFiles.id,
				r2Key: userFiles.r2Key,
				sizeBytes: userFiles.sizeBytes,
			})
			.from(userFiles)
			.where(and(eq(userFiles.id, fileId), eq(userFiles.userId, userId)))
			.get();

		return file ?? null;
	}

	async deleteUserFile(fileId: string, userId: string): Promise<boolean> {
		const result = await this.db
			.delete(userFiles)
			.where(and(eq(userFiles.id, fileId), eq(userFiles.userId, userId)))
			.returning({ id: userFiles.id });

		return result.length > 0;
	}

	async softDeleteScribeProject(
		projectId: string,
		userId: string,
	): Promise<boolean> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(scribeProjects)
			.set({
				isDeleted: 1,
				deletedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(scribeProjects.id, projectId),
					eq(scribeProjects.userId, userId),
				),
			)
			.returning({ id: scribeProjects.id });

		return result.length > 0;
	}

	async updateStorageUsage(userId: string, deltaBytes: number): Promise<void> {
		await this.db
			.update(profiles)
			.set({
				storageUsedBytes: sql`${profiles.storageUsedBytes} + ${deltaBytes}`,
				updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
			})
			.where(eq(profiles.id, userId));
	}

	async linkFileToTask(fileId: string, taskId: string): Promise<void> {
		await this.db
			.insert(taskResources)
			.values({
				fileId,
				taskId,
				associationType: "resource",
			})
			.onConflictDoNothing();
	}
}
