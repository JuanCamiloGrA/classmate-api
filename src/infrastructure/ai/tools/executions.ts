/**
 * Tool Executions for HITL (Human-in-the-Loop) Tools
 *
 * This file contains the actual execution logic for tools that require
 * user confirmation before running. Each function here corresponds to
 * a tool in class-tools.ts that doesn't have an execute function.
 *
 * The flow is:
 * 1. AI calls tool (e.g., removeClass) → no execute function
 * 2. Client shows confirmation UI to user
 * 3. User approves/denies
 * 4. processToolCalls() calls the matching function here
 */

import type { ToolExecutions } from "../utils";

/**
 * Execution implementations for HITL tools
 * These run AFTER user approval
 */
export const executions: ToolExecutions = {
	/**
	 * Remove a class - executes after user confirmation
	 * TODO: Replace with actual repository call when ready
	 */
	removeClass: async (
		{ classId, reason }: { classId: string; reason?: string },
		_context,
	) => {
		console.log(
			`[TOOL EXECUTION] removeClass approved for classId: ${classId}, reason: ${reason || "none"}`,
		);

		// MOCK: Replace with actual repository call
		// Example with real implementation:
		// const result = await classRepository.hardDelete(classId, userId);
		// return { success: true, deletedId: classId };

		return {
			success: true,
			message: `Class ${classId} has been permanently deleted.`,
			deletedId: classId,
		};
	},
};

/**
 * List of tool names that have HITL executions
 * Used for validation and type checking
 */
export const hitlToolNames = Object.keys(executions);
