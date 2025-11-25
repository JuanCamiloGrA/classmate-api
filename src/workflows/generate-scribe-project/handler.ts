import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { ScribeProject } from "../../domain/entities/scribe-project";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import {
	ARCHITECT_AGENT,
	type ArchitectOutput,
	GHOSTWRITER_AGENT,
	SUPERVISOR_AGENT,
	TYPESETTER_AGENT,
} from "../../domain/services/scribe/agents";
import type { ScribeAIService } from "../../infrastructure/ai/scribe.ai.service";
import type { WorkflowRequestBody } from "./types";

export class GenerateScribeProjectWorkflowHandler {
	constructor(
		private scribeAIService: ScribeAIService,
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
			// Use ScribeAIService with structured output (generateObject)
			// The system prompt is loaded from ASSETS via the agent config
			const output: ArchitectOutput =
				await this.scribeAIService.runAgentWithSchema(ARCHITECT_AGENT, {
					// If we have a file URL, pass it; otherwise use text content
					fileUrl: project.rubricFileUrl ?? undefined,
					fileMimeType: project.rubricMimeType ?? undefined,
					textContent: project.rubricContent ?? undefined,
				});

			return output;
		});

		// Update project based on Architect result
		await step.do("update-after-architect", async () => {
			// Check if we have sections with questions
			const hasQuestions =
				result.sections &&
				Array.isArray(result.sections) &&
				result.sections.some((s) => s.questions && s.questions.length > 0);

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
			}
		});
	}

	private async runGhostwriterAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const content = await step.do("ghostwriter-agent", async () => {
			// Use ScribeAIService with text output (generateText)
			// Template variables are replaced in the system prompt
			const response = await this.scribeAIService.runAgentWithText(
				GHOSTWRITER_AGENT,
				{
					// Pass rubric file if available
					fileUrl: project.rubricFileUrl ?? undefined,
					fileMimeType: project.rubricMimeType ?? undefined,
					// Pass text content with rubric and answers
					textContent: project.rubricContent
						? `RUBRIC:\n${project.rubricContent}\n\nUSER ANSWERS:\n${JSON.stringify(project.userAnswers || {}, null, 2)}`
						: `USER ANSWERS:\n${JSON.stringify(project.userAnswers || {}, null, 2)}`,
					templateVars: {
						RUBRIC: project.rubricContent || "",
						ANSWERS: JSON.stringify(project.userAnswers || {}),
					},
				},
			);
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
			// Use ScribeAIService with text output (generateText)
			const response = await this.scribeAIService.runAgentWithText(
				SUPERVISOR_AGENT,
				{
					// Pass rubric file if available for reference
					fileUrl: project.rubricFileUrl ?? undefined,
					fileMimeType: project.rubricMimeType ?? undefined,
					// Pass the content to review along with rubric context
					textContent: `CONTENT TO REVIEW:\n${project.contentMarkdown || ""}\n\nRUBRIC:\n${project.rubricContent || ""}`,
					templateVars: {
						CONTENT: project.contentMarkdown || "",
						RUBRIC: project.rubricContent || "",
					},
				},
			);

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
				// If revision is required, ask the user more questions
				if (review.questions && review.questions.length > 0) {
					await this.scribeProjectRepository.update(
						project.userId,
						project.id,
						{
							status: "collecting_answers",
							reviewFeedback: review,
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
							// Clear userAnswers to wait for new input
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
			// Use ScribeAIService with text output (generateText)
			const response = await this.scribeAIService.runAgentWithText(
				TYPESETTER_AGENT,
				{
					textContent: project.contentMarkdown || "",
					templateVars: {
						CONTENT: project.contentMarkdown || "",
					},
				},
			);
			return response;
		});

		await step.do("update-after-typesetter", async () => {
			await this.scribeProjectRepository.update(project.userId, project.id, {
				currentLatex: latex,
				status: "completed",
			});
		});
	}
}
