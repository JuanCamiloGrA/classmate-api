import type {
	ScribeProject,
	UpdateScribeProjectData,
} from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";

export class UpdateScribeProjectUseCase {
	constructor(private scribeProjectRepository: ScribeProjectRepository) {}

	async execute(
		userId: string,
		projectId: string,
		data: UpdateScribeProjectData,
	): Promise<ScribeProject> {
		return this.scribeProjectRepository.update(userId, projectId, data);
	}
}
