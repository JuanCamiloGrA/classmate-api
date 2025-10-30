import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { SummaryRepository } from "../../domain/repositories/summary.repository";
import type { AIService } from "../../domain/services/ai.service";
import type { MarkdownService } from "../../domain/services/markdown.service";
import type { ProcessingService } from "../../domain/services/processing.service";
import type { PromptService } from "../../domain/services/prompt.service";
import type { StorageService } from "../../domain/services/storage.service";
import { FileValidator } from "./file-validator";
import {
	type FileInput,
	PREPARE_FILE_INPUT_CONFIG,
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
		private processingService: ProcessingService,
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

		// Step 0: Prepare file input - convert URL to R2 file if needed
		const fileInput = await step.do(
			"prepare-file-input",
			PREPARE_FILE_INPUT_CONFIG,
			async () => {
				return await this.prepareFileInput(payload);
			},
		);

		// Step 1: Generate summary from file content
		const summaryMarkdown = await step.do(
			"generate-summary",
			WORKFLOW_CONFIG,
			async () => {
				return await this.generateSummary(payload.classId, fileInput);
			},
		);

		// Step 2: Convert markdown to HTML and save to database
		await step.do("save-summary", SAVE_SUMMARY_CONFIG, async () => {
			await this.saveSummary(payload, summaryMarkdown);
		});

		// Step 3: Cleanup - delete temporary file from R2
		await step.do("cleanup-temp-file", { timeout: "5 minutes" }, async () => {
			await this.cleanupTempFile(fileInput);
		});
	}

	private async prepareFileInput(
		payload: WorkflowRequestBody,
	): Promise<FileInput> {
		const { input, userId, classId } = payload;

		// Check if input is a URL (needs processing) or already an R2 file
		if ("sourceUrl" in input) {
			console.log("🔄 [WORKFLOW] Processing URL input", {
				classId,
				sourceUrl: input.sourceUrl,
				timestamp: new Date().toISOString(),
			});

			// Delegate heavy processing to Cloud Run service
			const fileInput = await this.processingService.processUrl(
				input.sourceUrl,
				userId,
				classId,
			);

			console.log("✅ [WORKFLOW] URL processed successfully", {
				classId,
				r2Key: fileInput.r2Key,
			});

			return fileInput;
		}

		// Input is already an R2 file, pass through
		console.log("✅ [WORKFLOW] Using pre-uploaded R2 file", {
			classId,
			r2Key: input.r2Key,
		});

		return input;
	}

	private async generateSummary(
		classId: string,
		file: FileInput,
	): Promise<string> {
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

	private async cleanupTempFile(file: FileInput): Promise<void> {
		console.log("🗑️ [WORKFLOW] Cleaning up temporary file", {
			r2Key: file.r2Key,
		});

		await this.storageService.deleteFile(file.r2Key);

		console.log("✅ [WORKFLOW] Temporary file deleted", {
			r2Key: file.r2Key,
		});
	}
}
