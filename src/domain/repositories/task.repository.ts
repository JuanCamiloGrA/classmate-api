import type {
	Task,
	TaskData,
	TaskListItem,
	TaskPriority,
	TaskStatus,
	TaskUpdateData,
	TaskWithResources,
} from "../entities/task";

export interface TaskFilters {
	subjectId?: string;
	status?: TaskStatus[];
	priority?: TaskPriority[];
	search?: string;
	dueDateFrom?: string;
	dueDateTo?: string;
	limit?: number;
	offset?: number;
	sortBy?: "dueDate" | "createdAt" | "priority";
	sortOrder?: "asc" | "desc";
}

export interface TaskListResult {
	data: TaskListItem[];
	total: number;
}

/**
 * Repository interface for task persistence operations.
 * Defines the contract for task data access.
 * Implementations must handle D1 database operations.
 * @interface TaskRepository
 */
export interface TaskRepository {
	/**
	 * List tasks with advanced filtering, sorting and pagination.
	 * @param userId - The user ID (ownership check)
	 * @param filters - Filter options
	 * @returns Object containing data array and total count
	 */
	findAll(userId: string, filters: TaskFilters): Promise<TaskListResult>;

	/**
	 * List all non-deleted tasks for a subject.
	 * Optimized to return only essential fields.
	 * @param userId - The user ID (ownership check)
	 * @param subjectId - The subject ID to fetch tasks for
	 * @returns Array of non-deleted tasks (optimized fields)
	 * @deprecated Use findAll instead
	 */
	findBySubjectIdAndUserId(
		userId: string,
		subjectId: string,
	): Promise<TaskListItem[]>;

	/**
	 * Retrieve a single task with all details and associated files.
	 * @param userId - The user ID (ownership check)
	 * @param taskId - The task ID to search for
	 * @returns The task with resources if found and belongs to user, null otherwise
	 */
	findByIdAndUserId(
		userId: string,
		taskId: string,
	): Promise<TaskWithResources | null>;

	/**
	 * Create a new task in the database.
	 * @param userId - The user ID who owns this task
	 * @param data - Task data to persist
	 * @returns The created task with system fields (id, timestamps)
	 */
	create(userId: string, data: TaskData): Promise<Task>;

	/**
	 * Update an existing task.
	 * @param userId - The user ID (ownership check)
	 * @param taskId - The task ID to update
	 * @param data - Partial task data to update
	 * @returns The updated task
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	update(userId: string, taskId: string, data: TaskUpdateData): Promise<Task>;

	/**
	 * Soft delete a task (marks as deleted, preserves data).
	 * @param userId - The user ID (ownership check)
	 * @param taskId - The task ID to soft delete
	 * @returns The deleted task with updated isDeleted and deletedAt fields
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	softDelete(userId: string, taskId: string): Promise<Task>;

	/**
	 * Hard delete a task (permanently removes data).
	 * Cascades to related task resources via foreign key constraints.
	 * @param userId - The user ID (ownership check)
	 * @param taskId - The task ID to permanently delete
	 * @returns The deleted task
	 * @throws NotFoundError if task not found or doesn't belong to user
	 */
	hardDelete(userId: string, taskId: string): Promise<Task>;
}
