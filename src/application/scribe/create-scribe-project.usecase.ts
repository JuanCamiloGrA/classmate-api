import type {
	CreateScribeProjectData,
	ScribeProject,
} from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";

export class CreateScribeProjectUseCase {
	constructor(private scribeProjectRepository: ScribeProjectRepository) {}

	async execute(data: CreateScribeProjectData): Promise<ScribeProject> {
		return this.scribeProjectRepository.create(data);
	}
}
