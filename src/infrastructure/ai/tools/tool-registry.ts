/**
 * Tool Registry
 * Central registry for loading tools based on agent mode
 * Uses factory pattern to inject dependencies at runtime
 */

import {
	type ClassTools,
	classToolsMeta,
	classToolsRequiringConfirmation,
	createClassTools,
} from "./class-tools";
import type {
	AgentMode,
	ClassmateToolName,
	ToolDependencies,
	ToolMetadata,
} from "./definitions";
import {
	createTaskTools,
	type TaskTools,
	taskToolsMeta,
	taskToolsRequiringConfirmation,
} from "./task-tools";

// ============================================
// COMBINED TYPES
// ============================================

export type AllTools = ClassTools & TaskTools;

// ============================================
// TOOL SETS BY MODE
// ============================================

/**
 * Tools available in DEFAULT mode (general assistant)
 * Full access to all tools including destructive operations
 */
const DEFAULT_TOOLS: ClassmateToolName[] = [
	// Class tools
	"listClasses",
	"getClass",
	"createClass",
	"deleteClass", // HITL - requires confirmation
	"updateClass", // HITL - requires confirmation
	// Task tools
	"listTasks",
	"getTask",
	"createTask",
	"deleteTask", // HITL - requires confirmation
	"updateTask", // HITL - requires confirmation
];

/**
 * Tools available in EXAM mode (exam preparation)
 * Read-only access for exam preparation
 */
const EXAM_TOOLS: ClassmateToolName[] = [
	"listClasses",
	"getClass",
	"listTasks",
	"getTask",
];

/**
 * Tools available in STUDY mode (focused learning)
 * Read-only access for study sessions
 */
const STUDY_TOOLS: ClassmateToolName[] = [
	"listClasses",
	"getClass",
	"listTasks",
	"getTask",
];

/**
 * Tools available in REVIEW mode (content review)
 * Read-only access for quick review
 */
const REVIEW_TOOLS: ClassmateToolName[] = [
	"listClasses",
	"getClass",
	"listTasks",
	"getTask",
];

/**
 * Mode to tools mapping
 */
const MODE_TOOLS_MAP: Record<AgentMode, ClassmateToolName[]> = {
	DEFAULT: DEFAULT_TOOLS,
	EXAM: EXAM_TOOLS,
	STUDY: STUDY_TOOLS,
	REVIEW: REVIEW_TOOLS,
};

// ============================================
// TOOL FACTORY
// ============================================

/**
 * Create all tools with injected dependencies
 * Returns combined class and task tools
 */
export function createAllTools(deps: ToolDependencies): AllTools {
	const classTools = createClassTools(deps);
	const taskTools = createTaskTools(deps);

	return {
		...classTools,
		...taskTools,
	};
}

/**
 * Get the tool set for a specific mode
 * Returns tools in the format expected by streamText
 */
export function getToolsForMode(mode: AgentMode, deps: ToolDependencies) {
	const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;
	const allTools = createAllTools(deps);

	const tools: Record<string, AllTools[keyof AllTools]> = {};

	for (const name of toolNames) {
		if (name in allTools) {
			tools[name] = allTools[name as keyof AllTools];
		}
	}

	return tools;
}

// ============================================
// METADATA REGISTRY
// ============================================

/** All tool metadata combined */
const allToolsMeta: ToolMetadata[] = [...classToolsMeta, ...taskToolsMeta];

/** All tools requiring confirmation combined */
const allToolsRequiringConfirmation = [
	...classToolsRequiringConfirmation,
	...taskToolsRequiringConfirmation,
];

/**
 * Get metadata for tools in a specific mode
 */
export function getToolMetadataForMode(mode: AgentMode): ToolMetadata[] {
	const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;

	return allToolsMeta.filter((meta) =>
		toolNames.includes(meta.name as ClassmateToolName),
	);
}

/**
 * Get names of tools requiring confirmation for a mode
 */
export function getToolsRequiringConfirmationForMode(
	mode: AgentMode,
): string[] {
	const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;

	return allToolsRequiringConfirmation.filter((name) =>
		toolNames.includes(name as ClassmateToolName),
	);
}

/**
 * Check if a tool requires confirmation
 */
export function toolRequiresConfirmation(toolName: string): boolean {
	return allToolsRequiringConfirmation.includes(toolName);
}

/**
 * Get all available tool names across all modes
 */
export function getAllToolNames(): ClassmateToolName[] {
	return [...new Set(Object.values(MODE_TOOLS_MAP).flat())];
}

// ============================================
// EXPORTS
// ============================================

export {
	classToolsMeta,
	classToolsRequiringConfirmation,
	taskToolsMeta,
	taskToolsRequiringConfirmation,
	allToolsMeta,
	allToolsRequiringConfirmation,
	MODE_TOOLS_MAP,
};
