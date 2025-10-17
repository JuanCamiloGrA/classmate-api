/**
 * DTO for listing subjects.
 * Used in HTTP responses to structure returned data.
 */
export interface ListSubjectsDTO {
	success: boolean;
	result: Array<{
		id: string;
		name: string;
		termId: string;
		createdAt: string;
		updatedAt: string;
	}>;
}

/**
 * DTO for creating a subject.
 * Used in HTTP responses to structure returned data.
 */
export interface CreateSubjectDTO {
	success: boolean;
	result: {
		id: string;
		name: string;
		termId: string;
		createdAt: string;
		updatedAt: string;
	};
}

/**
 * DTO for updating a subject.
 * Used in HTTP responses to structure returned data.
 */
export interface UpdateSubjectDTO {
	success: boolean;
	result: {
		id: string;
		name: string;
		termId: string;
		updatedAt: string;
	};
}

/**
 * DTO for deleting a subject (soft or hard).
 * Used in HTTP responses to structure returned data.
 */
export interface DeleteSubjectDTO {
	success: boolean;
	result: {
		id: string;
		isDeleted?: number;
		deletedAt?: string | null;
	};
}
