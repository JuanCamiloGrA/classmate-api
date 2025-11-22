import type {
	Class,
	ClassAIStatus,
	ClassData,
	ClassListItem,
	ClassStatus,
	ClassUpdateData,
	ClassWithResources,
} from "../entities/class";

export interface ClassFilters {
	subjectId?: string;
	status?: ClassStatus[];
	aiStatus?: ClassAIStatus[];
	isProcessed?: boolean;
	search?: string;
	startDateFrom?: string;
	startDateTo?: string;
	endDateFrom?: string;
	endDateTo?: string;
	limit?: number;
	offset?: number;
	sortBy?: "startDate" | "createdAt" | "status";
	sortOrder?: "asc" | "desc";
}

export interface ClassListResult {
	data: ClassListItem[];
	total: number;
}

/**
 * Repository interface for class persistence operations.
 * Defines the contract for class data access.
 * Implementations must handle D1 database operations.
 * @interface ClassRepository
 */
export interface ClassRepository {
	/**
	 * List classes with advanced filtering, sorting and pagination.
	 * @param userId - The user ID (ownership check)
	 * @param filters - Filter options
	 * @returns Object containing data array and total count
	 */
	findAll(userId: string, filters: ClassFilters): Promise<ClassListResult>;

	/**
	 * Retrieve a single class with all details and associated files.
	 * @param userId - The user ID (ownership check)
	 * @param classId - The class ID to search for
	 * @returns The class with resources if found and belongs to user, null otherwise
	 */
	findByIdAndUserId(
		userId: string,
		classId: string,
	): Promise<ClassWithResources | null>;

	/**
	 * Create a new class in the database.
	 * @param userId - The user ID who owns this class
	 * @param data - Class data to persist
	 * @returns The created class with system fields (id, timestamps)
	 */
	create(userId: string, data: ClassData): Promise<Class>;

	/**
	 * Update an existing class.
	 * @param userId - The user ID (ownership check)
	 * @param classId - The class ID to update
	 * @param data - Partial class data to update
	 * @returns The updated class
	 * @throws NotFoundError if class not found or doesn't belong to user
	 */
	update(
		userId: string,
		classId: string,
		data: ClassUpdateData,
	): Promise<Class>;

	/**
	 * Soft delete a class (marks as deleted, preserves data).
	 * @param userId - The user ID (ownership check)
	 * @param classId - The class ID to soft delete
	 * @returns The deleted class with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if class not found or doesn't belong to user
	 */
	softDelete(userId: string, classId: string): Promise<Class>;

	/**
	 * Hard delete a class (permanently removes data).
	 * Cascades to related class resources via foreign key constraints.
	 * @param userId - The user ID (ownership check)
	 * @param classId - The class ID to permanently delete
	 * @returns The deleted class
	 * @throws NotFoundError if class not found or doesn't belong to user
	 */
	hardDelete(userId: string, classId: string): Promise<Class>;
}
