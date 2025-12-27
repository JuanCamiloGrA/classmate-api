/**
 * Tool Registry
 * Central registry for loading tools based on agent mode
 */

import {
	classTools,
	classToolsMeta,
	classToolsRequiringConfirmation,
} from "./class-tools";
import type { AgentMode, ClassmateToolName, ToolMetadata } from "./definitions";

// ============================================
// TOOL SETS BY MODE
// ============================================

/**
 * Tools available in DEFAULT mode (general assistant)
 */
const DEFAULT_TOOLS: ClassmateToolName[] = [
	"readClassContent",
	"listClasses",
	"getClassSummary",
	"removeClass", // Available but requires confirmation
];

/**
 * Tools available in EXAM mode (exam preparation)
 */
const EXAM_TOOLS: ClassmateToolName[] = [
	"readClassContent",
	"listClasses",
	"getClassSummary",
	// removeClass NOT available in exam mode
];

/**
 * Tools available in STUDY mode (focused learning)
 */
const STUDY_TOOLS: ClassmateToolName[] = [
	"readClassContent",
	"getClassSummary",
];

/**
 * Tools available in REVIEW mode (content review)
 */
const REVIEW_TOOLS: ClassmateToolName[] = [
	"readClassContent",
	"listClasses",
	"getClassSummary",
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
// REGISTRY FUNCTIONS
// ============================================

/**
 * Get the tool set for a specific mode
 * Returns tools in the format expected by streamText
 */
export function getToolsForMode(mode: AgentMode) {
	const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;

	const tools: Record<string, (typeof classTools)[keyof typeof classTools]> =
		{};

	for (const name of toolNames) {
		if (name in classTools) {
			tools[name] = classTools[name as keyof typeof classTools];
		}
	}

	return tools;
}

/**
 * Get metadata for tools in a specific mode
 */
export function getToolMetadataForMode(mode: AgentMode): ToolMetadata[] {
	const toolNames = MODE_TOOLS_MAP[mode] || MODE_TOOLS_MAP.DEFAULT;

	return classToolsMeta.filter((meta) =>
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

	return classToolsRequiringConfirmation.filter((name) =>
		toolNames.includes(name as ClassmateToolName),
	);
}

/**
 * Check if a tool requires confirmation
 */
export function toolRequiresConfirmation(toolName: string): boolean {
	return classToolsRequiringConfirmation.includes(toolName);
}

/**
 * Get all available tool names across all modes
 */
export function getAllToolNames(): ClassmateToolName[] {
	return Object.keys(classTools) as ClassmateToolName[];
}

// ============================================
// EXPORTS
// ============================================

export { classTools, classToolsMeta, classToolsRequiringConfirmation };
