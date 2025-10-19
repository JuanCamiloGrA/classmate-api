import type {
	TaskListItem,
	TaskStatus,
	TaskWithResources,
} from "../../domain/entities/task";

/**
 * Data Transfer Object for task list response
 */
export interface TaskListDTO {
	id: string;
	subject_id: string;
	title: string;
	due_date: string | null;
	status: TaskStatus;
	grade: number | null;
	created_at: string;
	updated_at: string;
}

/**
 * Data Transfer Object for task detail response
 */
export interface TaskDetailDTO {
	id: string;
	subject_id: string;
	title: string;
	due_date: string | null;
	status: TaskStatus;
	content: string | null;
	grade: number | null;
	is_deleted: number;
	deleted_at: string | null;
	created_at: string;
	updated_at: string;
	resources: Array<{
		id: string;
		original_filename: string;
		mime_type: string;
		size_bytes: number;
		association_type: string;
	}>;
}

/**
 * Convert TaskListItem to TaskListDTO
 */
export function toTaskListDTO(task: TaskListItem): TaskListDTO {
	return {
		id: task.id,
		subject_id: task.subjectId,
		title: task.title,
		due_date: task.dueDate,
		status: task.status,
		grade: task.grade,
		created_at: task.createdAt,
		updated_at: task.updatedAt,
	};
}

/**
 * Convert TaskWithResources to TaskDetailDTO
 */
export function toTaskDetailDTO(task: TaskWithResources): TaskDetailDTO {
	return {
		id: task.id,
		subject_id: task.subjectId,
		title: task.title,
		due_date: task.dueDate,
		status: task.status,
		content: task.content,
		grade: task.grade,
		is_deleted: task.isDeleted,
		deleted_at: task.deletedAt,
		created_at: task.createdAt,
		updated_at: task.updatedAt,
		resources: task.resources.map((resource) => ({
			id: resource.id,
			original_filename: resource.originalFilename,
			mime_type: resource.mimeType,
			size_bytes: resource.sizeBytes,
			association_type: resource.associationType,
		})),
	};
}
