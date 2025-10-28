import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { SummaryRepository } from "../../domain/repositories/summary.repository";
import type { AIService } from "../../domain/services/ai.service";
import type { MarkdownService } from "../../domain/services/markdown.service";
import type { PromptService } from "../../domain/services/prompt.service";
import type { StorageService } from "../../domain/services/storage.service";
import { FileValidator } from "./file-validator";
import {
	SAVE_SUMMARY_CONFIG,
	WORKFLOW_CONFIG,
	type WorkflowRequestBody,
} from "./types";

/**
 * Summarize Class Workflow Handler
 * Orchestrates the workflow steps for generating class summaries from audio/text files
 */
export class SummarizeClassWorkflowHandler {
	private fileValidator: FileValidator;

	constructor(
		private aiService: AIService,
		private storageService: StorageService,
		private summaryRepository: SummaryRepository,
		private markdownService: MarkdownService,
		private promptService: PromptService,
	) {
		this.fileValidator = new FileValidator();
	}

	async run(
		event: WorkflowEvent<WorkflowRequestBody>,
		step: WorkflowStep,
	): Promise<void> {
		const payload = event.payload;

		// Step 1: Generate summary from file content
		const summaryMarkdown = await step.do(
			"generate-summary",
			WORKFLOW_CONFIG,
			async () => {
				return await this.generateSummary(payload);
			},
		);

		// Step 2: Convert markdown to HTML and save to database
		await step.do("save-summary", SAVE_SUMMARY_CONFIG, async () => {
			await this.saveSummary(payload, summaryMarkdown);
		});

		// Step 3: Cleanup - delete temporary file from R2
		await step.do("cleanup-temp-file", { timeout: "5 minutes" }, async () => {
			await this.cleanupTempFile(payload);
		});
	}

	private async generateSummary(payload: WorkflowRequestBody): Promise<string> {
		const { file, classId } = payload;
		const { mimeType, filename, r2Key } = file;

		const isAudioFile = this.fileValidator.isAudioFile(mimeType, filename);
		const audioMimeType = this.fileValidator.getAudioMimeType(
			mimeType,
			filename,
		);

		console.log("📥 [WORKFLOW] Generating summary", {
			classId,
			r2Key,
			isAudio: isAudioFile,
			timestamp: new Date().toISOString(),
		});

		// Download file from R2
		const bytes = await this.storageService.getFileBytes(r2Key);

		// Load prompt template
		const prompt = await this.promptService.loadPrompt();

		// Determine content type and generate summary
		const content = isAudioFile ? bytes : new TextDecoder().decode(bytes);
		const summary = await this.aiService.generateContent(
			prompt,
			content,
			isAudioFile,
			audioMimeType,
		);

		if (!summary || typeof summary !== "string") {
			throw new Error("AI service returned empty response");
		}

		console.log("✅ [WORKFLOW] Summary generated successfully", {
			classId,
			summaryLength: summary.length,
		});

		return summary;
	}

	private async saveSummary(
		payload: WorkflowRequestBody,
		summaryMarkdown: string,
	): Promise<void> {
		const { classId, userId } = payload;

		// Convert markdown to HTML
		const htmlSummary = this.markdownService.parse(summaryMarkdown);

		console.log("🔄 [WORKFLOW] Converted markdown to HTML", {
			originalLength: summaryMarkdown.length,
			convertedLength: htmlSummary.length,
			classId,
		});

		// Save to database
		await this.summaryRepository.save(classId, userId, htmlSummary);

		console.log("✅ [WORKFLOW] Summary saved to database", { classId });
	}

	private async cleanupTempFile(payload: WorkflowRequestBody): Promise<void> {
		const { file, classId } = payload;

		console.log("🗑️ [WORKFLOW] Cleaning up temporary file", {
			classId,
			r2Key: file.r2Key,
		});

		await this.storageService.deleteFile(file.r2Key);

		console.log("✅ [WORKFLOW] Temporary file deleted", {
			classId,
			r2Key: file.r2Key,
		});
	}
}
