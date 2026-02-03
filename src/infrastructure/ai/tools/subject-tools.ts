/**
 * Subject-related Tools for ClassmateAgent
 * Factory pattern for dependency injection of repositories
 */
import { tool } from "ai";
import { z } from "zod";
import {
	errorResult,
	successResult,
	type ToolDependencies,
	type ToolMetadata,
} from "./definitions";

// ============================================
// TOOL METADATA
// ============================================

export const createSubjectMeta: ToolMetadata = {
	name: "createSubject",
	description: "Create a new subject within a term.",
	requiresConfirmation: false,
	category: "subject",
};

export const updateSubjectMeta: ToolMetadata = {
	name: "updateSubject",
	description:
		"Update an existing subject fields like name, professor, schedule, or theme.",
	requiresConfirmation: false,
	category: "subject",
};

/** Metadata for all subject tools */
export const subjectToolsMeta: ToolMetadata[] = [
	createSubjectMeta,
	updateSubjectMeta,
];

/** Names of tools that require HITL confirmation */
export const subjectToolsRequiringConfirmation = subjectToolsMeta
	.filter((m) => m.requiresConfirmation)
	.map((m) => m.name);

// ============================================
// INPUT SCHEMAS
// ============================================

export const createSubjectInputSchema = z.object({
	name: z.string().min(1).describe("Subject name"),
	termId: z.string().min(1).describe("Term ID the subject belongs to"),
});

export const updateSubjectInputSchema = z
	.object({
		subjectId: z.string().describe("The unique identifier of the subject"),
		name: z.string().min(1).optional().describe("New subject name"),
		termId: z.string().min(1).optional().describe("New term ID"),
		professor: z.string().optional().describe("Professor name"),
		credits: z.number().int().positive().optional().describe("Credit hours"),
		location: z.string().optional().describe("Location"),
		scheduleText: z
			.string()
			.optional()
			.describe("Schedule text (e.g., Mon/Wed 9-10am)"),
		syllabusUrl: z.string().url().optional().describe("Syllabus URL"),
		colorTheme: z.string().min(1).optional().describe("Color theme"),
	})
	.refine(
		(data) => Object.keys(data).filter((key) => key !== "subjectId").length > 0,
		{
			message: "At least one field must be provided for update",
		},
	);

// ============================================
// TOOL FACTORY
// ============================================

/**
 * Create subject tools with injected dependencies
 * This factory allows us to pass userId and repositories at runtime
 */
export function createSubjectTools(deps: ToolDependencies) {
	const { userId, subjectRepository } = deps;

	/**
	 * Create Subject - Automatic execution
	 */
	const createSubject = tool({
		description: createSubjectMeta.description,
		inputSchema: createSubjectInputSchema,
		execute: async (params) => {
			try {
				const subject = await subjectRepository.create(userId, {
					name: params.name,
					termId: params.termId,
				});

				return successResult({
					message: "Subject created successfully",
					subject,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to create subject";
				return errorResult(message);
			}
		},
	});

	/**
	 * Update Subject - Automatic execution
	 */
	const updateSubject = tool({
		description: updateSubjectMeta.description,
		inputSchema: updateSubjectInputSchema,
		execute: async ({ subjectId, ...updates }) => {
			try {
				const subject = await subjectRepository.update(
					userId,
					subjectId,
					updates,
				);

				return successResult({
					message: "Subject updated successfully",
					subject,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to update subject";
				return errorResult(message);
			}
		},
	});

	return {
		createSubject,
		updateSubject,
	};
}

// ============================================
// TYPE EXPORTS
// ============================================

export type SubjectTools = ReturnType<typeof createSubjectTools>;
