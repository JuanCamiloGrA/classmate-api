/**
 * DTO for listing terms.
 * Used in HTTP responses to structure returned data.
 */
export interface ListTermsDTO {
	success: boolean;
	result: Array<{
		id: string;
		name: string;
		order: number;
		createdAt: string;
		updatedAt: string;
	}>;
}

/**
 * DTO for creating a term.
 * Used in HTTP responses to structure returned data.
 */
export interface CreateTermDTO {
	success: boolean;
	result: {
		id: string;
		name: string;
		order: number;
		createdAt: string;
		updatedAt: string;
	};
}

/**
 * DTO for updating a term.
 * Used in HTTP responses to structure returned data.
 */
export interface UpdateTermDTO {
	success: boolean;
	result: {
		id: string;
		name: string;
		order: number;
		updatedAt: string;
	};
}

/**
 * DTO for deleting a term (soft or hard).
 * Used in HTTP responses to structure returned data.
 */
export interface DeleteTermDTO {
	success: boolean;
	result: {
		id: string;
		isDeleted?: number;
		deletedAt?: string | null;
	};
}
