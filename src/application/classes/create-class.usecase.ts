import type { Class, ClassData } from "../../domain/entities/class";
import type { ClassRepository } from "../../domain/repositories/class.repository";

/**
 * Use case for creating a new class.
 *
 * @class CreateClassUseCase
 */
export class CreateClassUseCase {
	/**
	 * @param classRepository - Repository for class persistence
	 */
	constructor(private classRepository: ClassRepository) {}

	/**
	 * Execute class creation.
	 * @param userId - The authenticated user ID
	 * @param data - Class data to create
	 * @returns The created class
	 */
	async execute(userId: string, data: ClassData): Promise<Class> {
		return this.classRepository.create(userId, data);
	}
}
