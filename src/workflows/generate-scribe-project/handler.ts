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
			if (result.questions && result.questions.length > 0) {
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "collecting_answers",
					formQuestions: result.questions,
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
			const jsonStr = response.replace(/```json\n?|\n?```/g, "").trim();
			return JSON.parse(jsonStr);
		});

		await step.do("update-after-supervisor", async () => {
			if (review.approved) {
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "typesetting",
					reviewFeedback: review,
				});
			} else {
				await this.scribeProjectRepository.update(project.userId, project.id, {
					status: "drafting", // Back to drafting
					reviewFeedback: review,
				});
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
