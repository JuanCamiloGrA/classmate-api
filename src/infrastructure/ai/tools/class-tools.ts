/**
 * Class-related Tools for ClassmateAgent
 * Includes both automatic and HITL (Human-in-the-Loop) tools
 */
import { tool } from "ai";
import { z } from "zod";
import { successResult, type ToolMetadata } from "./definitions";

// ============================================
// TOOL METADATA
// ============================================

export const readClassContentMeta: ToolMetadata = {
	name: "readClassContent",
	description: "Retrieve the content and summary of a specific class",
	requiresConfirmation: false,
	category: "class",
};

export const removeClassMeta: ToolMetadata = {
	name: "removeClass",
	description: "Permanently delete a class and all its associated resources",
	requiresConfirmation: true, // HITL - requires user approval
	category: "class",
};

export const listClassesMeta: ToolMetadata = {
	name: "listClasses",
	description: "List all classes for the current user, optionally filtered",
	requiresConfirmation: false,
	category: "class",
};

export const getClassSummaryMeta: ToolMetadata = {
	name: "getClassSummary",
	description: "Get a brief summary of a class without full content",
	requiresConfirmation: false,
	category: "class",
};

// ============================================
// TOOL IMPLEMENTATIONS (MOCKS)
// ============================================

/**
 * Read Class Content - Automatic execution
 * Returns mock JSON content for now
 */
export const readClassContentTool = tool({
	description: readClassContentMeta.description,
	inputSchema: z.object({
		classId: z.string().describe("The unique identifier of the class"),
	}),
	execute: async ({ classId }) => {
		// MOCK: Replace with actual repository call
		console.log(`[TOOL] readClassContent called for classId: ${classId}`);

		const mockClass = {
			id: classId,
			title: "Introduction to Calculus",
			subject: "Mathematics",
			summary: "This class covers the fundamentals of differential calculus...",
			content:
				"# Introduction to Calculus\n\n## Key Concepts\n- Limits\n- Derivatives",
			topics: ["limits", "derivatives", "integrals"],
			duration_seconds: 3600,
			status: "completed",
			ai_status: "done",
		};

		return successResult(mockClass);
	},
});

/**
 * Remove Class - HITL (requires confirmation)
 * NO execute function = pauses for user approval
 */
export const removeClassTool = tool({
	description: `${removeClassMeta.description}. WARNING: This action is irreversible.`,
	inputSchema: z.object({
		classId: z
			.string()
			.describe("The unique identifier of the class to delete"),
		reason: z.string().optional().describe("Optional reason for deletion"),
	}),
	// NO execute function - this triggers HITL flow
	// The client will receive this tool call and must approve/deny
});

/**
 * List Classes - Automatic execution
 */
export const listClassesTool = tool({
	description: listClassesMeta.description,
	inputSchema: z.object({
		subjectId: z.string().optional().describe("Filter by subject ID"),
		status: z
			.enum(["scheduled", "live", "completed"])
			.optional()
			.describe("Filter by class status"),
		limit: z.number().optional().default(10).describe("Max results to return"),
	}),
	execute: async ({ subjectId, status, limit }) => {
		// MOCK: Replace with actual repository call
		console.log(`[TOOL] listClasses called`, { subjectId, status, limit });

		const mockClasses = [
			{
				id: "class-1",
				title: "Introduction to Calculus",
				subject_id: subjectId || "math-101",
				status: "completed",
				start_date: "2024-01-15T10:00:00Z",
			},
			{
				id: "class-2",
				title: "Advanced Algebra",
				subject_id: subjectId || "math-101",
				status: "completed",
				start_date: "2024-01-16T10:00:00Z",
			},
		];

		return successResult({
			classes: mockClasses.slice(0, limit),
			total: mockClasses.length,
		});
	},
});

/**
 * Get Class Summary - Automatic execution
 */
export const getClassSummaryTool = tool({
	description: getClassSummaryMeta.description,
	inputSchema: z.object({
		classId: z.string().describe("The unique identifier of the class"),
	}),
	execute: async ({ classId }) => {
		// MOCK: Replace with actual repository call
		console.log(`[TOOL] getClassSummary called for classId: ${classId}`);

		return successResult({
			id: classId,
			title: "Introduction to Calculus",
			summary: "Covers limits, derivatives, and their applications in physics.",
			topics: ["limits", "derivatives", "applications"],
			duration_minutes: 60,
		});
	},
});

// ============================================
// TOOL COLLECTIONS
// ============================================

/** All class-related tools as a record for streamText */
export const classTools = {
	readClassContent: readClassContentTool,
	removeClass: removeClassTool,
	listClasses: listClassesTool,
	getClassSummary: getClassSummaryTool,
};

/** Metadata for all class tools */
export const classToolsMeta: ToolMetadata[] = [
	readClassContentMeta,
	removeClassMeta,
	listClassesMeta,
	getClassSummaryMeta,
];

/** Names of tools that require HITL confirmation */
export const classToolsRequiringConfirmation = classToolsMeta
	.filter((m) => m.requiresConfirmation)
	.map((m) => m.name);
