import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";

export class UnlockScribePdfUseCase {
	constructor(
		private readonly scribeProjectRepository: ScribeProjectRepository,
	) {}

	async execute(params: { userId: string; projectId: string }): Promise<void> {
		const project = await this.scribeProjectRepository.findById(
			params.userId,
			params.projectId,
		);
		if (!project) throw new Error("Scribe project not found");

		// UX-only gating: always allow transition to available.
		await this.scribeProjectRepository.update(params.userId, params.projectId, {
			status: "available",
		});
	}
}
