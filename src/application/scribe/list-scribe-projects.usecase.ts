import type { ScribeProject } from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";

export class ListScribeProjectsUseCase {
	constructor(private scribeProjectRepository: ScribeProjectRepository) {}

	async execute(userId: string): Promise<ScribeProject[]> {
		return this.scribeProjectRepository.listByUserId(userId);
	}
}
