import type {
	ClassFilters,
	ClassListResult,
	ClassRepository,
} from "../../domain/repositories/class.repository";

/**
 * Use case for listing all classes for a specific subject.
 * Returns optimized class list with only essential fields.
 *
 * @class ListClassesUseCase
 */
export class ListClassesUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute class listing.
	 * @param userId - The authenticated user ID
	 * @param filters - Filter options to refine the query
	 * @returns Object containing data array and total count
	 */
	async execute(
		userId: string,
		filters: ClassFilters,
	): Promise<ClassListResult> {
		return this.classRepository.findAll(userId, filters);
	}
}
