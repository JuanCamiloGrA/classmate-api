import { z } from "zod";

// =============================================================================
// Scribe v2: Agent output schemas
// =============================================================================

/**
 * Question types supported by the Scribe v2 dynamic form.
 * - text: free-form text input (short/long decided by the client)
 * - image_file: client must upload an image to R2 and answer with {file_route,...}
 */
export const ScribeFormQuestionSchema = z.object({
	id: z.string().min(1).describe("Unique identifier for the question"),
	type: z.enum(["text", "image_file"]).describe("Field type"),
	label: z.string().min(1).describe("User-facing label"),
	help_text: z
		.string()
		.min(1)
		.describe("Markdown help text with detailed instructions"),
	required: z.boolean().default(true),
});

export type ScribeFormQuestion = z.infer<typeof ScribeFormQuestionSchema>;

export const ScribeFormSectionSchema = z.object({
	section_title: z.string().min(1),
	questions: z.array(ScribeFormQuestionSchema).min(1),
});

export const ScribeFormSchema = z.object({
	form_title: z.string().min(1),
	estimated_time: z.string().min(1),
	sections: z.array(ScribeFormSectionSchema).min(1),
});

// =============================================================================
// Typst payload schema (consumed by SCRIBE_HEAVY_API via ScribePdfService)
// =============================================================================

const TypesetterAuthorSchema = z.object({
	name: z.string(),
	affiliation: z.string(),
	email: z.string().optional(),
});

export const ScribeTypstPayloadSchema = z.object({
	metadata: z.object({
		title: z.string(),
		authors: z.array(TypesetterAuthorSchema),
		date: z.string(),
		abstract: z.string().optional(),
	}),
	content: z.object({
		body: z
			.string()
			.describe(
				'Raw Typst content. Must reference images using #image("<file_route>") where file_route is an R2 key.',
			),
		references: z.string(),
	}),
	template_config: z.record(z.any()),
});

export type ScribeTypstPayload = z.infer<typeof ScribeTypstPayloadSchema>;

export const ScribeAgentOutputSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("needs_input"),
		form: ScribeFormSchema,
	}),
	z.object({
		kind: z.literal("ready"),
		typstPayload: ScribeTypstPayloadSchema,
	}),
]);

export type ScribeAgentOutput = z.infer<typeof ScribeAgentOutputSchema>;

// =============================================================================
// Exam schema
// =============================================================================

export const ScribeExamQuestionSchema = z.object({
	id: z.string().min(1),
	prompt: z.string().min(1),
	options: z
		.object({
			a: z.string().min(1),
			b: z.string().min(1),
			c: z.string().min(1),
			d: z.string().min(1),
		})
		.describe("Multiple-choice options"),
	correct: z.enum(["a", "b", "c", "d"]),
});

export const ScribeExamSchema = z.object({
	questions: z.array(ScribeExamQuestionSchema).max(10),
});

export type ScribeExam = z.infer<typeof ScribeExamSchema>;

// =============================================================================
// Agent configurations
// =============================================================================

export interface ScribeAgentConfig {
	model: string;
	promptPath: string;
	outputSchema?: z.ZodType;
	description: string;
}

export interface ScribeAgentWithSchema<TSchema extends z.ZodType>
	extends ScribeAgentConfig {
	outputSchema: TSchema;
}

export const SCRIBE_AGENT: ScribeAgentWithSchema<
	typeof ScribeAgentOutputSchema
> = {
	model: "google/gemini-3-flash",
	promptPath: "scribe/prompt-scribe-agent.txt",
	outputSchema: ScribeAgentOutputSchema,
	description:
		"Single-step Scribe agent: returns either needs_input form schema or a ready Typst payload",
};

export const SCRIBE_EXAM_AGENT: ScribeAgentWithSchema<typeof ScribeExamSchema> =
	{
		model: "google/gemini-3-flash",
		promptPath: "scribe/prompt-scribe-exam-agent.txt",
		outputSchema: ScribeExamSchema,
		description:
			"Generates a short multiple-choice exam from the rubric and generated PDF",
	};

export const SCRIBE_FIXER_AGENT: ScribeAgentConfig = {
	model: "xai/grok-4.1-fast-reasoning",
	promptPath: "scribe/prompt-scribe-fixer-agent.txt",
	description:
		"Fixes Typst compilation errors by editing the Typst body string using the edit tool and retrying compilation",
};

// =============================================================================
// Supported MIME Types for Rubric Files
// =============================================================================

/**
 * Supported MIME types for rubric file uploads.
 * These are the formats that Gemini models can process directly.
 */
export const SUPPORTED_RUBRIC_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
	"text/plain",
	"text/markdown",
] as const;

export type SupportedRubricMimeType =
	(typeof SUPPORTED_RUBRIC_MIME_TYPES)[number];

export function isSupportedRubricMimeType(
	mimeType: string,
): mimeType is SupportedRubricMimeType {
	return SUPPORTED_RUBRIC_MIME_TYPES.includes(
		mimeType as SupportedRubricMimeType,
	);
}
