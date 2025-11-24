import type {
	CreateScribeProjectData,
	ScribeProject,
	UpdateScribeProjectData,
} from "../entities/scribe-project";

/**
 * Repository interface for Scribe Project persistence operations.
 * Defines the contract for project data access.
 */
export interface ScribeProjectRepository {
	/**
	 * Retrieve a single project by ID and User ID.
	 * @param userId - The user ID (ownership check)
	 * @param projectId - The project ID to search for
	 * @returns The project if found and belongs to user, null otherwise
	 */
	findById(userId: string, projectId: string): Promise<ScribeProject | null>;

	/**
	 * List all projects for a user.
	 * @param userId - The user ID
	 * @returns Array of projects
	 */
	listByUserId(userId: string): Promise<ScribeProject[]>;

	/**
	 * Create a new project in the database.
	 * @param data - Project data to persist
	 * @returns The created project
	 */
	create(data: CreateScribeProjectData): Promise<ScribeProject>;

	/**
	 * Update an existing project.
	 * @param userId - The user ID (ownership check)
	 * @param projectId - The project ID to update
	 * @param data - Partial project data to update
	 * @returns The updated project
	 */
	update(
		userId: string,
		projectId: string,
		data: UpdateScribeProjectData,
	): Promise<ScribeProject>;

	/**
	 * Delete a project.
	 * @param userId - The user ID (ownership check)
	 * @param projectId - The project ID to delete
	 */
	delete(userId: string, projectId: string): Promise<void>;
}
