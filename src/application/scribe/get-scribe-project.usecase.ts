import type { ScribeProject } from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";

export class GetScribeProjectUseCase {
	constructor(private scribeProjectRepository: ScribeProjectRepository) {}

	async execute(
		userId: string,
		projectId: string,
	): Promise<ScribeProject | null> {
		return this.scribeProjectRepository.findById(userId, projectId);
	}
}
