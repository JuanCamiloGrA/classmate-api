import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { ScribeProject } from "../../domain/entities/scribe-project";
import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { SubjectRepository } from "../../domain/repositories/subject.repository";
import {
	ARCHITECT_AGENT,
	type ArchitectOutput,
	GHOSTWRITER_AGENT,
	SUPERVISOR_AGENT,
	TYPESETTER_AGENT,
	type TypesetterOutput,
} from "../../domain/services/scribe/agents";
import type { ScribeAIService } from "../../infrastructure/ai/scribe.ai.service";
import type { ScribeManifestService } from "../../infrastructure/api/scribe-manifest.service";
import type { ScribePdfService } from "../../infrastructure/pdf/scribe-pdf.service";
import type { WorkflowRequestBody } from "./types";

/** Expiration time for presigned PDF URLs (7 days in seconds) */
const PDF_PRESIGNED_URL_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

export class GenerateScribeProjectWorkflowHandler {
	constructor(
		private scribeAIService: ScribeAIService,
		private scribeProjectRepository: ScribeProjectRepository,
		private profileRepository: ProfileRepository,
		private subjectRepository: SubjectRepository,
		private pdfService: ScribePdfService,
		private manifestService: ScribeManifestService,
		private storageAdapter: StorageRepository,
		private r2BucketName: string,
	) {}

	async run(
		event: WorkflowEvent<WorkflowRequestBody>,
		step: WorkflowStep,
	): Promise<void> {
		const { projectId, userId } = event.payload;

		// 1. Fetch Project
		let project = await step.do("fetch-project", async () => {
			const p = await this.scribeProjectRepository.findById(userId, projectId);
			if (!p) throw new Error(`Project ${projectId} not found`);
			return p;
		});

		console.log(
			`[SCRIBE] Processing project ${projectId} in status ${project.status}`,
		);

		// State Machine - continues until a waiting state or completion
		// Loop to chain agents in the same workflow invocation
		while (true) {
			if (project.status === "draft") {
				await this.runArchitectAgent(project, step);
				// After architect, status becomes collecting_answers (waiting for user)
				// or drafting (no questions needed). We break to let user respond.
				break;
			}

			if (project.status === "collecting_answers") {
				if (project.userAnswers) {
					await this.runGhostwriterAgent(project, step);
					// After ghostwriter, status becomes "reviewing" - continue to supervisor
					project = await step.do("refetch-after-ghostwriter", async () => {
						const p = await this.scribeProjectRepository.findById(
							userId,
							projectId,
						);
						if (!p) throw new Error(`Project ${projectId} not found`);
						return p;
					});
					continue; // Continue to next iteration to run supervisor
				}
				console.log("[SCRIBE] Waiting for user answers");
				break;
			}

			if (project.status === "drafting") {
				await this.runGhostwriterAgent(project, step);
				// After ghostwriter, status becomes "reviewing" - continue to supervisor
				project = await step.do(
					"refetch-after-ghostwriter-drafting",
					async () => {
						const p = await this.scribeProjectRepository.findById(
							userId,
							projectId,
						);
						if (!p) throw new Error(`Project ${projectId} not found`);
						return p;
					},
				);
				continue; // Continue to next iteration to run supervisor
			}

			if (project.status === "reviewing") {
				await this.runSupervisorAgent(project, step);
				// After supervisor, status becomes:
				// - "typesetting" if approved -> continue to typesetter
				// - "collecting_answers" if rejected -> break to wait for user
				project = await step.do("refetch-after-supervisor", async () => {
					const p = await this.scribeProjectRepository.findById(
						userId,
						projectId,
					);
					if (!p) throw new Error(`Project ${projectId} not found`);
					return p;
				});

				if (project.status === "typesetting") {
					continue; // Continue to typesetter
				}
				// If collecting_answers, break to wait for user input
				break;
			}

			if (project.status === "typesetting") {
				await this.runTypesetterAgent(project, step);
				// After typesetter, status becomes "completed" - done!
				console.log(`[SCRIBE] Project ${projectId} completed successfully`);
				break;
			}

			if (project.status === "completed") {
				console.log(`[SCRIBE] Project ${projectId} already completed`);
				break;
			}

			if (project.status === "failed") {
				console.log(`[SCRIBE] Project ${projectId} is in failed state`);
				break;
			}

			// Unknown status - break to avoid infinite loop
			console.warn(`[SCRIBE] Unknown status: ${project.status}`);
			break;
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

	/**
	 * Builds the rubric section for text content.
	 * Handles both text rubrics and file-based rubrics (PDF/image).
	 */
	private buildRubricSection(project: ScribeProject): string {
		if (project.rubricContent) {
			return `RUBRIC:\n${project.rubricContent}`;
		}
		if (project.rubricFileUrl) {
			return "RUBRIC: (See attached file - the rubric was provided as a PDF/image attachment)";
		}
		return "";
	}

	private async runGhostwriterAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		// Determine if this is a revision (previous markdown exists)
		const isRevision = !!project.contentMarkdown;

		const content = await step.do("ghostwriter-agent", async () => {
			// Build the text content based on whether this is initial or revision
			let textContent: string;

			if (isRevision) {
				// MODE B: Revision - Include previous markdown and label new answers
				textContent = this.buildRevisionContext(project);
			} else {
				// MODE A: Initial Draft
				// Include rubric section (handles both text and file-based rubrics)
				const rubricSection = this.buildRubricSection(project);
				const answersSection = `USER ANSWERS:\n${JSON.stringify(project.userAnswers || {}, null, 2)}`;
				textContent = rubricSection
					? `${rubricSection}\n\n${answersSection}`
					: answersSection;
			}

			// Use ScribeAIService with text output (generateText)
			const response = await this.scribeAIService.runAgentWithText(
				GHOSTWRITER_AGENT,
				{
					// Pass rubric file if available
					fileUrl: project.rubricFileUrl ?? undefined,
					fileMimeType: project.rubricMimeType ?? undefined,
					textContent,
					templateVars: {
						RUBRIC: project.rubricContent || "",
						ANSWERS: JSON.stringify(project.userAnswers || {}),
						PREVIOUS_MARKDOWN: project.contentMarkdown || "",
						IS_REVISION: isRevision ? "true" : "false",
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

	/**
	 * Builds the context for a revision request.
	 * Separates initial answers from revision answers for the Ghostwriter.
	 */
	private buildRevisionContext(project: ScribeProject): string {
		const parts: string[] = [];

		// 1. Rubric (handles both text and file-based rubrics)
		const rubricSection = this.buildRubricSection(project);
		if (rubricSection) {
			parts.push(rubricSection);
		}

		// 2. Previous Markdown Draft (the one that needs improvement)
		parts.push(
			`PREVIOUS MARKDOWN DRAFT (needs revision):\n${project.contentMarkdown}`,
		);

		// 3. User answers - parse to separate initial from revision answers
		const userAnswers = project.userAnswers as Record<string, unknown> | null;
		if (userAnswers) {
			// Check if answers are already structured with rounds
			if (userAnswers._initialAnswers || userAnswers._revisionAnswers) {
				// Structured format
				if (userAnswers._initialAnswers) {
					parts.push(
						`INITIAL ANSWERS (from first form):\n${JSON.stringify(userAnswers._initialAnswers, null, 2)}`,
					);
				}
				if (
					userAnswers._revisionAnswers &&
					Array.isArray(userAnswers._revisionAnswers)
				) {
					for (let i = 0; i < userAnswers._revisionAnswers.length; i++) {
						parts.push(
							`REVISION ANSWERS (round ${i + 1}):\n${JSON.stringify(userAnswers._revisionAnswers[i], null, 2)}`,
						);
					}
				}
			} else {
				// Legacy flat format - treat all as initial
				parts.push(`INITIAL ANSWERS:\n${JSON.stringify(userAnswers, null, 2)}`);
			}
		}

		// 4. Feedback from supervisor (why it was rejected)
		if (project.reviewFeedback) {
			const feedback = project.reviewFeedback as { feedback_summary?: string };
			if (feedback.feedback_summary) {
				parts.push(
					`SUPERVISOR FEEDBACK (reason for revision):\n${feedback.feedback_summary}`,
				);
			}
		}

		return parts.join("\n\n---\n\n");
	}

	private async runSupervisorAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		const review = await step.do("supervisor-agent", async () => {
			// Build textContent with content to review and rubric section
			const rubricSection = this.buildRubricSection(project);
			let textContent = `CONTENT TO REVIEW:\n${project.contentMarkdown || ""}`;
			if (rubricSection) {
				textContent += `\n\n${rubricSection}`;
			}

			// Use ScribeAIService with text output (generateText)
			const response = await this.scribeAIService.runAgentWithText(
				SUPERVISOR_AGENT,
				{
					// Pass rubric file if available for reference
					fileUrl: project.rubricFileUrl ?? undefined,
					fileMimeType: project.rubricMimeType ?? undefined,
					// Pass the content to review along with rubric context
					textContent,
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
					// Preserve existing answers in a structured format for context accumulation
					const existingAnswers = project.userAnswers as Record<
						string,
						unknown
					> | null;
					const structuredAnswers =
						this.structureAnswersForRevision(existingAnswers);

					await this.scribeProjectRepository.update(
						project.userId,
						project.id,
						{
							status: "collecting_answers",
							reviewFeedback: review,
							formQuestions: {
								form_title: "Additional Information Needed",
								estimated_time: "5 minutes",
								sections: [
									{
										section_title: "Clarifications",
										questions: review.questions,
									},
								],
							},
							// Preserve structured answers - new answers will be merged in update endpoint
							userAnswers: structuredAnswers,
						},
					);
				} else {
					// Fallback if no questions - this shouldn't happen with the new prompt
					// but we keep it for safety
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

	/**
	 * Structures existing answers to preserve them during revision rounds.
	 * Converts flat answers to structured format with _initialAnswers and _revisionAnswers.
	 */
	private structureAnswersForRevision(
		existingAnswers: Record<string, unknown> | null,
	): Record<string, unknown> {
		if (!existingAnswers) {
			return {};
		}

		// Already structured format - return as-is
		if (existingAnswers._initialAnswers !== undefined) {
			return existingAnswers;
		}

		// Convert flat format to structured
		// All current answers become initial answers
		return {
			_initialAnswers: existingAnswers,
			_revisionAnswers: [],
		};
	}

	private async runTypesetterAgent(
		project: ScribeProject,
		step: WorkflowStep,
	): Promise<void> {
		// Step 1: Fetch manifest for the template to get config schema
		const manifest = await step.do("fetch-template-manifest", async () => {
			return this.manifestService.getManifest(project.templateId);
		});

		// Step 2: Generate structured output using Typesetter Agent
		// Inject the template config schema into the prompt
		const typesetterResult: TypesetterOutput = await step.do(
			"typesetter-agent",
			async () => {
				const output = await this.scribeAIService.runAgentWithSchema(
					TYPESETTER_AGENT,
					{
						textContent: project.contentMarkdown || "",
						templateVars: {
							TEMPLATE_CONFIG_SCHEMA_JSON: JSON.stringify(
								manifest.template_config_schema,
								null,
								2,
							),
						},
					},
				);
				return output;
			},
		);

		// Step 3: Enrich metadata with fallbacks from repositories
		const enrichedMetadata = await step.do("enrich-metadata", async () => {
			// Start with a copy of authors from the AI result
			const authors: Array<{
				name: string;
				affiliation: string;
				email?: string;
			}> = typesetterResult.metadata.authors.map((a) => ({
				name: a.name,
				affiliation: a.affiliation,
				email: a.email,
			}));

			// Fallback: If no authors or using default, try to get from profile
			if (
				authors.length === 0 ||
				(authors.length === 1 && authors[0].name === "Anonymous")
			) {
				const profile = await this.profileRepository.findById(project.userId);
				if (profile?.name) {
					authors[0] = {
						name: profile.name,
						affiliation: authors[0]?.affiliation || "Independent Researcher",
						email: profile.email || undefined,
					};
				}
			}

			// Fallback: If subject exists, use it for affiliation context
			if (project.subjectId && authors.length > 0) {
				const subject = await this.subjectRepository.findByIdAndUserId(
					project.userId,
					project.subjectId,
				);
				if (
					subject?.name &&
					authors[0].affiliation === "Independent Researcher"
				) {
					authors[0] = {
						name: authors[0].name,
						affiliation: subject.name,
						email: authors[0].email,
					};
				}
			}

			return {
				title:
					typesetterResult.metadata.title ||
					project.title ||
					"Untitled Document",
				authors,
				date: typesetterResult.metadata.date,
				abstract: typesetterResult.metadata.abstract,
			};
		});

		// Step 4: Call PDF generation service with Typst payload
		const pdfResult = await step.do("generate-pdf", async () => {
			const result = await this.pdfService.generatePdf({
				user_id: project.userId,
				template_id: project.templateId,
				metadata: enrichedMetadata,
				content: {
					body: typesetterResult.content.body,
					references: typesetterResult.content.references,
				},
				template_config: typesetterResult.template_config,
			});
			return result;
		});

		// Step 5: Generate presigned URL for the PDF
		const presignedUrl = await step.do("generate-presigned-url", async () => {
			const url = await this.storageAdapter.generatePresignedGetUrl(
				this.r2BucketName,
				pdfResult.r2Key,
				PDF_PRESIGNED_URL_EXPIRATION_SECONDS,
			);
			return url;
		});

		// Step 6: Update project with PDF info
		await step.do("update-after-typesetter", async () => {
			await this.scribeProjectRepository.update(project.userId, project.id, {
				currentTypstJson: JSON.stringify(typesetterResult),
				finalPdfFileId: pdfResult.r2Key,
				finalPdfUrl: presignedUrl,
				status: "completed",
			});
		});
	}
}
