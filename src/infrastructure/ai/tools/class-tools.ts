/**
 * Class-related Tools for ClassmateAgent
 * Factory pattern for dependency injection of repositories
 * Includes both automatic and HITL (Human-in-the-Loop) tools
 */
import { tool } from "ai";
import { z } from "zod";
import type { ClassRepository } from "../../../domain/repositories/class.repository";
import {
	errorResult,
	successResult,
	type ToolDependencies,
	type ToolMetadata,
} from "./definitions";

// ============================================
// TOOL METADATA
// ============================================

export const listClassesMeta: ToolMetadata = {
	name: "listClasses",
	description:
		"List all classes for the user with pagination and filtering options. Returns class metadata without content field for efficiency.",
	requiresConfirmation: false,
	category: "class",
};

export const getClassMeta: ToolMetadata = {
	name: "getClass",
	description:
		"Get a single class with all its fields including content, summary, and transcription. Use this to read full class details.",
	requiresConfirmation: false,
	category: "class",
};

export const createClassMeta: ToolMetadata = {
	name: "createClass",
	description: "Create a new class/lecture session for a subject.",
	requiresConfirmation: false,
	category: "class",
};

export const deleteClassMeta: ToolMetadata = {
	name: "deleteClass",
	description:
		"Permanently delete a class and all its associated resources. This action is irreversible.",
	requiresConfirmation: true, // HITL - requires user approval
	category: "class",
};

export const updateClassMeta: ToolMetadata = {
	name: "updateClass",
	description:
		"Update an existing class fields like title, dates, status, content, etc.",
	requiresConfirmation: true, // HITL - requires user approval
	category: "class",
};

/** Metadata for all class tools */
export const classToolsMeta: ToolMetadata[] = [
	listClassesMeta,
	getClassMeta,
	createClassMeta,
	deleteClassMeta,
	updateClassMeta,
];

/** Names of tools that require HITL confirmation */
export const classToolsRequiringConfirmation = classToolsMeta
	.filter((m) => m.requiresConfirmation)
	.map((m) => m.name);

// ============================================
// ZOD SCHEMAS (for filtering/pagination)
// ============================================

const classStatusSchema = z.enum(["scheduled", "live", "completed"]);
const classAiStatusSchema = z.enum(["none", "processing", "done", "failed"]);
const sortBySchema = z.enum(["startDate", "createdAt", "status"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

// ============================================
// INPUT SCHEMAS
// ============================================

export const listClassesInputSchema = z.object({
	subjectId: z.string().optional().describe("Filter by subject ID"),
	status: z
		.array(classStatusSchema)
		.optional()
		.describe("Filter by class status(es): scheduled, live, completed"),
	aiStatus: z
		.array(classAiStatusSchema)
		.optional()
		.describe("Filter by AI status(es): none, processing, done, failed"),
	isProcessed: z.boolean().optional().describe("Filter by processing state"),
	search: z.string().optional().describe("Search by title (case-insensitive)"),
	startDateFrom: z
		.string()
		.optional()
		.describe("Filter classes starting from this date (ISO 8601)"),
	startDateTo: z
		.string()
		.optional()
		.describe("Filter classes starting before this date (ISO 8601)"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.default(20)
		.describe("Max results to return (1-100, default 20)"),
	offset: z
		.number()
		.min(0)
		.optional()
		.default(0)
		.describe("Number of results to skip for pagination"),
	sortBy: sortBySchema
		.optional()
		.default("startDate")
		.describe("Sort field: startDate, createdAt, or status"),
	sortOrder: sortOrderSchema
		.optional()
		.default("desc")
		.describe("Sort order: asc or desc"),
});

export const getClassInputSchema = z.object({
	classId: z.string().describe("The unique identifier of the class"),
});

export const createClassInputSchema = z.object({
	subjectId: z.string().describe("Subject ID this class belongs to"),
	title: z.string().optional().describe("Class title"),
	startDate: z
		.string()
		.optional()
		.describe("Start date/time (ISO 8601 format)"),
	endDate: z.string().optional().describe("End date/time (ISO 8601 format)"),
	status: classStatusSchema
		.optional()
		.default("scheduled")
		.describe("Initial status: scheduled, live, or completed"),
	link: z
		.string()
		.optional()
		.describe("Class link (e.g., meeting URL or recording)"),
	meetingLink: z.string().optional().describe("Dedicated meeting link"),
	roomLocation: z.string().optional().describe("Physical room or location"),
	content: z.string().optional().describe("Class content/notes"),
});

export const deleteClassInputSchema = z.object({
	classId: z.string().describe("The unique identifier of the class to delete"),
	reason: z.string().optional().describe("Optional reason for deletion"),
});

export const updateClassInputSchema = z.object({
	classId: z.string().describe("The unique identifier of the class to update"),
	title: z.string().optional().describe("New title"),
	startDate: z.string().optional().describe("New start date (ISO 8601)"),
	endDate: z.string().optional().describe("New end date (ISO 8601)"),
	status: classStatusSchema.optional().describe("New status"),
	link: z.string().optional().describe("New class link"),
	meetingLink: z.string().optional().describe("New meeting link"),
	roomLocation: z.string().optional().describe("New room location"),
	content: z.string().optional().describe("New content/notes"),
	topics: z.string().optional().describe("Topics covered (JSON string)"),
});

// ============================================
// TOOL FACTORY
// ============================================

/**
 * Create class tools with injected dependencies
 * This factory allows us to pass userId and repositories at runtime
 */
export function createClassTools(deps: ToolDependencies) {
	const { userId, classRepository } = deps;

	/**
	 * List Classes - Automatic execution
	 * Returns paginated list without content field
	 */
	const listClasses = tool({
		description: listClassesMeta.description,
		inputSchema: listClassesInputSchema,
		execute: async (params) => {
			try {
				const result = await classRepository.findAll(userId, {
					subjectId: params.subjectId,
					status: params.status,
					aiStatus: params.aiStatus,
					isProcessed: params.isProcessed,
					search: params.search,
					startDateFrom: params.startDateFrom,
					startDateTo: params.startDateTo,
					limit: params.limit,
					offset: params.offset,
					sortBy: params.sortBy,
					sortOrder: params.sortOrder,
				});

				return successResult({
					classes: result.data,
					total: result.total,
					limit: params.limit,
					offset: params.offset,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to list classes";
				return errorResult(message);
			}
		},
	});

	/**
	 * Get Class - Automatic execution
	 * Returns full class details including content
	 */
	const getClass = tool({
		description: getClassMeta.description,
		inputSchema: getClassInputSchema,
		execute: async ({ classId }) => {
			try {
				const classData = await classRepository.findByIdAndUserId(
					userId,
					classId,
				);

				if (!classData) {
					return errorResult(`Class with ID ${classId} not found`);
				}

				return successResult(classData);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to get class";
				return errorResult(message);
			}
		},
	});

	/**
	 * Create Class - Automatic execution
	 */
	const createClass = tool({
		description: createClassMeta.description,
		inputSchema: createClassInputSchema,
		execute: async (params) => {
			try {
				const newClass = await classRepository.create(userId, {
					subjectId: params.subjectId,
					title: params.title,
					startDate: params.startDate,
					endDate: params.endDate,
					status: params.status,
					link: params.link,
					meetingLink: params.meetingLink,
					roomLocation: params.roomLocation,
					content: params.content,
				});

				return successResult({
					message: "Class created successfully",
					class: newClass,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to create class";
				return errorResult(message);
			}
		},
	});

	/**
	 * Delete Class - HITL (requires confirmation)
	 * NO execute function = pauses for user approval
	 */
	const deleteClass = tool({
		description: `${deleteClassMeta.description} WARNING: This action is irreversible.`,
		inputSchema: deleteClassInputSchema,
		// NO execute function - this triggers HITL flow
		// The client will receive this tool call and must approve/deny
		// Actual execution happens in executions.ts after approval
	});

	/**
	 * Update Class - HITL (requires confirmation)
	 * NO execute function = pauses for user approval
	 */
	const updateClass = tool({
		description: updateClassMeta.description,
		inputSchema: updateClassInputSchema,
		// NO execute function - this triggers HITL flow
		// Actual execution happens in executions.ts after approval
	});

	return {
		listClasses,
		getClass,
		createClass,
		deleteClass,
		updateClass,
	};
}

// ============================================
// TYPE EXPORTS
// ============================================

export type ClassTools = ReturnType<typeof createClassTools>;
