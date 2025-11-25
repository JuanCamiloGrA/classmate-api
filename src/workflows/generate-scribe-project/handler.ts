import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { ScribeProject } from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import type { AIService } from "../../domain/services/ai.service";
import type { PromptService } from "../../domain/services/prompt.service";
import type { WorkflowRequestBody } from "./types";

export class GenerateScribeProjectWorkflowHandler {
	constructor(
		private aiService: AIService,
		private promptService: PromptService,
		private scribeProjectRepository: ScribeProjectRepository,
	) {}

	async run(
		event: WorkflowEvent<WorkflowRequestBody>,
		step: WorkflowStep,
	): Promise<void> {
		const { projectId, userId } = event.payload;

		// 1. Fetch Project
		const project = await step.do("fetch-project", async () => {
			const p = await this.scribeProjectRepository.findById(userId, projectId);
			if (!p) throw new Error(`Project ${projectId} not found`);
			return p;
		});

		console.log(
			`[SCRIBE] Processing project ${projectId} in status ${project.status}`,
		);

		// State Machine
		if (project.status === "draft") {
			await this.runArchitectAgent(project, step);
		} else if (project.status === "collecting_answers") {
			if (project.userAnswers) {
				await this.runGhostwriterAgent(project, step);
			} else {
				console.log("[SCRIBE] Waiting for user answers");
			}
		} else if (project.status === "drafting") {
			await this.runGhostwriterAgent(project, step);
		} else if (project.status === "reviewing") {
			await this.runSupervisorAgent(project, step);
		} else if (project.status === "typesetting") {
			await this.runTypesetterAgent(project, step);
		}
	}

	private async runArchitectAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const result = await step.do("architect-agent", async () => {
			const promptTemplate = await this.promptService.getPrompt(
				"scribe/prompt-01-architect.txt",
			);
			const prompt = promptTemplate.replace(
				"{{RUBRIC}}",
				project.rubricContent || "No rubric provided.",
			);

			const response = await this.aiService.generateContent(
				prompt,
				"", // No binary content
				false,
			);

			// Parse JSON response from AI
			// Assuming AI returns JSON wrapped in ```json ... ``` or just JSON
			const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
			return JSON.parse(jsonStr);
		});

		// Update project based on Architect result
		await step.do("update-after-architect", async () => {
			// Check if we have sections with questions (Architect prompt schema)
			const hasQuestions =
				result.sections &&
				Array.isArray(result.sections) &&
				result.sections.some(
					(s: { questions?: unknown[] }) =>
						s.questions && s.questions.length > 0,
				);

			if (hasQuestions) {
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "collecting_answers",
					formQuestions: result,
				});
			} else {
				// No questions, proceed to drafting
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "drafting",
				});
				// Trigger next step immediately? Or let next run handle it?
				// For now, we update state. The workflow might need to re-trigger or continue.
				// Since we are in a workflow, we can just call the next method if we want to chain.
				// But for simplicity/robustness, we'll let the next trigger handle it, or we can recursively call logic.
				// However, Cloudflare Workflows are step-based.
			}
		});
	}

	private async runGhostwriterAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const content = await step.do("ghostwriter-agent", async () => {
			const promptTemplate = await this.promptService.getPrompt(
				"scribe/prompt-02-ghostwriter.txt",
			);
			let prompt = promptTemplate.replace(
				"{{RUBRIC}}",
				project.rubricContent || "",
			);
			prompt = prompt.replace(
				"{{ANSWERS}}",
				JSON.stringify(project.userAnswers || {}),
			);

			const response = await this.aiService.generateContent(prompt, "", false);
			return response;
		});

		await step.do("update-after-ghostwriter", async () => {
			await this.scribeProjectRepository.update(project.userId, project.id, {
				contentMarkdown: content,
				status: "reviewing",
			});
		});
	}

	private async runSupervisorAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const review = await step.do("supervisor-agent", async () => {
			const promptTemplate = await this.promptService.getPrompt(
				"scribe/prompt-03-supervisor.txt",
			);
			let prompt = promptTemplate.replace(
				"{{CONTENT}}",
				project.contentMarkdown || "",
			);
			prompt = prompt.replace("{{RUBRIC}}", project.rubricContent || "");

			const response = await this.aiService.generateContent(prompt, "", false);

			// Handle "STATUS: APPROVED"
			if (response.includes("STATUS: APPROVED")) {
				return { approved: true };
			}

			const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
			try {
				const parsed = JSON.parse(jsonStr);
				return { approved: false, ...parsed };
			} catch (e) {
				console.error("Failed to parse Supervisor response", response);
				throw e;
			}
		});

		await step.do("update-after-supervisor", async () => {
			if (review.approved) {
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "typesetting",
					reviewFeedback: review,
				});
			} else {
				// If revision is required, we need to ask the user more questions
				// We reuse 'collecting_answers' state but with new questions
				if (review.questions && review.questions.length > 0) {
					await this.scribeProjectRepository.update(
						project.userId,
						project.id,
						{
							status: "collecting_answers",
							reviewFeedback: review,
							// Reset user answers? Or keep them?
							// If we keep them, we need to make sure the UI handles merging or showing new questions.
							// For now, let's assume we just present the new questions.
							formQuestions: {
								form_title: "Revision Needed",
								estimated_time: "5 minutes",
								sections: [
									{
										section_title: "Clarifications",
										questions: review.questions,
									},
								],
							},
							// We might want to clear userAnswers so the workflow waits for new ones
							// But we should probably keep the old ones for history?
							// The Ghostwriter uses `project.userAnswers`.
							// If we clear it, Ghostwriter loses context.
							// If we don't clear it, the workflow check `if (project.userAnswers)` might trigger immediately if it checks for *any* answers.
							// But `project.userAnswers` is the *current* state.
							// If we want to wait for *new* answers, we might need to clear it or have a flag.
							// The `run` method:
							// if (project.status === "collecting_answers") {
							//    if (project.userAnswers) { ... }
							// }
							// If we leave `userAnswers` populated, it will loop immediately!
							// So we MUST clear `userAnswers` (or move them to history) to wait for new input.
							userAnswers: null,
						},
					);
				} else {
					// Fallback if no questions
					await this.scribeProjectRepository.update(
						project.userId,
						project.id,
						{
							status: "drafting",
							reviewFeedback: review,
						},
					);
				}
			}
		});
	}

	private async runTypesetterAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const latex = await step.do("typesetter-agent", async () => {
			const promptTemplate = await this.promptService.getPrompt(
				"scribe/prompt-04-typesetter.txt",
			);
			const prompt = promptTemplate.replace(
				"{{CONTENT}}",
				project.contentMarkdown || "",
			);

			const response = await this.aiService.generateContent(prompt, "", false);
			return response;
		});

		await step.do("update-after-typesetter", async () => {
			await this.scribeProjectRepository.update(project.userId, project.id, {
				currentLatex: latex,
				status: "completed", // Or 'pdf_generation' if we had that step
			});
		});
	}
}
