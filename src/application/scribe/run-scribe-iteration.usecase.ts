import type { ProfileRepository } from "../../domain/repositories/profile.repository";
import type { ScribeProjectRepository } from "../../domain/repositories/scribe-project.repository";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import {
	SCRIBE_AGENT,
	SCRIBE_EXAM_AGENT,
	type ScribeAgentOutput,
	type ScribeExam,
} from "../../domain/services/scribe/agents";
import type { ScribeAIService } from "../../infrastructure/ai/scribe.ai.service";
import type { ScribeManifestService } from "../../infrastructure/api/scribe-manifest.service";
import type { DevLogger } from "../../infrastructure/logging/dev-logger";
import type {
	ScribePdfContent,
	ScribePdfMetadata,
	ScribePdfService,
} from "../../infrastructure/pdf/scribe-pdf.service";

const PDF_PRESIGNED_URL_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;
const ATTACHMENT_URL_EXPIRATION_SECONDS = 60 * 60;

type FileAttachment = { url: string; mediaType: string; filename?: string };

function collectFileRoutes(
	value: unknown,
): Array<{ file_route: string; mimeType?: string }> {
	const results: Array<{ file_route: string; mimeType?: string }> = [];
	const visit = (v: unknown) => {
		if (!v || typeof v !== "object") return;
		if (Array.isArray(v)) {
			for (const item of v) visit(item);
			return;
		}
		const obj = v as Record<string, unknown>;
		if (typeof obj.file_route === "string" && obj.file_route.length > 0) {
			results.push({
				file_route: obj.file_route,
				mimeType: typeof obj.mimeType === "string" ? obj.mimeType : undefined,
			});
		}
		for (const child of Object.values(obj)) visit(child);
	};
	visit(value);
	return results;
}

export interface RunScribeIterationOptions {
	bucket: string;
}

export type RunScribeIterationResult =
	| { kind: "form"; projectId: string; status: "needs_input"; form: unknown }
	| {
			kind: "result";
			projectId: string;
			status: "blocked";
			pdfUrl: string;
			exam: ScribeExam;
	  };

export class RunScribeIterationUseCase {
	constructor(
		private readonly scribeAIService: ScribeAIService,
		private readonly scribeProjectRepository: ScribeProjectRepository,
		private readonly profileRepository: ProfileRepository,
		private readonly manifestService: ScribeManifestService,
		private readonly pdfService: ScribePdfService,
		private readonly storage: StorageRepository,
		private readonly options: RunScribeIterationOptions,
		private readonly logger?: DevLogger,
	) {}

	async execute(params: {
		userId: string;
		projectId: string;
	}): Promise<RunScribeIterationResult> {
		this.logger?.log(
			"SCRIBE_USECASE",
			"Executing RunScribeIterationUseCase",
			params,
		);
		const project = await this.scribeProjectRepository.findById(
			params.userId,
			params.projectId,
		);
		if (!project) throw new Error("Scribe project not found");

		const profile = await this.profileRepository.findById(params.userId);
		if (!profile) throw new Error("Profile not found");

		const manifest = await this.manifestService.getManifest(project.templateId);

		const attachments: FileAttachment[] = [];

		// Rubric file (if present)
		if (project.rubricFileUrl && project.rubricMimeType) {
			attachments.push({
				url: project.rubricFileUrl,
				mediaType: project.rubricMimeType,
				filename: "rubric",
			});
		}

		// Style refs (stored as r2Key; attach via presigned GET)
		const styleRefs: Array<{ slot: 1 | 2; file_route: string }> = [];
		if (profile.scribeStyleSlot1R2Key && profile.scribeStyleSlot1MimeType) {
			styleRefs.push({ slot: 1, file_route: profile.scribeStyleSlot1R2Key });
			attachments.push({
				url: await this.storage.generatePresignedGetUrl(
					this.options.bucket,
					profile.scribeStyleSlot1R2Key,
					ATTACHMENT_URL_EXPIRATION_SECONDS,
				),
				mediaType: profile.scribeStyleSlot1MimeType,
				filename: profile.scribeStyleSlot1OriginalFilename ?? "style_ref_1",
			});
		}
		if (profile.scribeStyleSlot2R2Key && profile.scribeStyleSlot2MimeType) {
			styleRefs.push({ slot: 2, file_route: profile.scribeStyleSlot2R2Key });
			attachments.push({
				url: await this.storage.generatePresignedGetUrl(
					this.options.bucket,
					profile.scribeStyleSlot2R2Key,
					ATTACHMENT_URL_EXPIRATION_SECONDS,
				),
				mediaType: profile.scribeStyleSlot2MimeType,
				filename: profile.scribeStyleSlot2OriginalFilename ?? "style_ref_2",
			});
		}

		// Answer images
		const answerImageRoutes = collectFileRoutes(project.userAnswers);
		for (const img of answerImageRoutes) {
			attachments.push({
				url: await this.storage.generatePresignedGetUrl(
					this.options.bucket,
					img.file_route,
					ATTACHMENT_URL_EXPIRATION_SECONDS,
				),
				mediaType: img.mimeType ?? "image/png",
				filename: "answer_image",
			});
		}

		const textContent = [
			project.rubricContent ? `RUBRIC_TEXT:\n${project.rubricContent}` : "",
			`USER_ANSWERS_JSON:\n${JSON.stringify(project.userAnswers ?? {}, null, 2)}`,
			`STYLE_REFERENCES:\n${JSON.stringify(styleRefs, null, 2)}`,
			`ANSWER_IMAGES:\n${JSON.stringify(answerImageRoutes, null, 2)}`,
		]
			.filter(Boolean)
			.join("\n\n---\n\n");

		const output: ScribeAgentOutput =
			await this.scribeAIService.runAgentWithSchema(SCRIBE_AGENT, {
				files: attachments,
				textContent,
				templateVars: {
					TEMPLATE_CONFIG_SCHEMA_JSON: JSON.stringify(
						manifest.template_config_schema,
						null,
						2,
					),
				},
			});

		if (output.kind === "needs_input") {
			await this.scribeProjectRepository.update(
				params.userId,
				params.projectId,
				{
					status: "needs_input",
					formSchema: output.form,
				},
			);
			return {
				kind: "form",
				projectId: params.projectId,
				status: "needs_input",
				form: output.form,
			};
		}

		// ready → generate PDF
		await this.scribeProjectRepository.update(params.userId, params.projectId, {
			status: "processing",
			formSchema: null,
		});

		// Zod-validated payload; cast to the exact Heavy API request types.
		const pdfMetadata = output.typstPayload.metadata as ScribePdfMetadata;
		const pdfContent = output.typstPayload.content as ScribePdfContent;

		const pdfResult = await this.pdfService.generatePdf({
			user_id: params.userId,
			template_id: project.templateId,
			metadata: pdfMetadata,
			content: pdfContent,
			template_config: output.typstPayload.template_config,
		});

		const pdfUrl = await this.storage.generatePresignedGetUrl(
			this.options.bucket,
			pdfResult.r2Key,
			PDF_PRESIGNED_URL_EXPIRATION_SECONDS,
		);

		// Exam agent (rubric + generated pdf)
		const examFiles: FileAttachment[] = [];
		if (project.rubricFileUrl && project.rubricMimeType) {
			examFiles.push({
				url: project.rubricFileUrl,
				mediaType: project.rubricMimeType,
				filename: "rubric",
			});
		}
		examFiles.push({
			url: await this.storage.generatePresignedGetUrl(
				this.options.bucket,
				pdfResult.r2Key,
				ATTACHMENT_URL_EXPIRATION_SECONDS,
			),
			mediaType: "application/pdf",
			filename: "generated.pdf",
		});

		const examText = project.rubricContent
			? `RUBRIC_TEXT:\n${project.rubricContent}`
			: "";

		const exam: ScribeExam = await this.scribeAIService.runAgentWithSchema(
			SCRIBE_EXAM_AGENT,
			{ files: examFiles, textContent: examText },
		);

		await this.scribeProjectRepository.update(params.userId, params.projectId, {
			status: "blocked",
			finalPdfFileId: pdfResult.r2Key,
			finalPdfUrl: pdfUrl,
			exam,
		});

		return {
			kind: "result",
			projectId: params.projectId,
			status: "blocked",
			pdfUrl,
			exam,
		};
	}
}
