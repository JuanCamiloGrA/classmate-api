import type {
	ClassListItem,
	ClassWithResources,
} from "../../domain/entities/class";

/**
 * Data Transfer Object for class list response
 */
export interface ClassListDTO {
	id: string;
	subject_id: string;
	title: string | null;
	start_date: string | null;
	end_date: string | null;
	link: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Data Transfer Object for class detail response
 */
export interface ClassDetailDTO {
	id: string;
	subject_id: string;
	title: string | null;
	start_date: string | null;
	end_date: string | null;
	link: string | null;
	content: string | null;
	summary: string | null;
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
 * Convert ClassListItem to ClassListDTO
 */
export function toClassListDTO(classItem: ClassListItem): ClassListDTO {
	return {
		id: classItem.id,
		subject_id: classItem.subjectId,
		title: classItem.title,
		start_date: classItem.startDate,
		end_date: classItem.endDate,
		link: classItem.link,
		created_at: classItem.createdAt,
		updated_at: classItem.updatedAt,
	};
}

/**
 * Convert ClassWithResources to ClassDetailDTO
 */
export function toClassDetailDTO(
	classItem: ClassWithResources,
): ClassDetailDTO {
	return {
		id: classItem.id,
		subject_id: classItem.subjectId,
		title: classItem.title,
		start_date: classItem.startDate,
		end_date: classItem.endDate,
		link: classItem.link,
		content: classItem.content,
		summary: classItem.summary,
		is_deleted: classItem.isDeleted,
		deleted_at: classItem.deletedAt,
		created_at: classItem.createdAt,
		updated_at: classItem.updatedAt,
		resources: classItem.resources.map((resource) => ({
			id: resource.id,
			original_filename: resource.originalFilename,
			mime_type: resource.mimeType,
			size_bytes: resource.sizeBytes,
			association_type: resource.associationType,
		})),
	};
}
