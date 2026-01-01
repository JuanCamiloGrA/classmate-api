/**
 * AI Chat Utilities
 * Handles HITL tool processing and message cleanup
 * Based on Cloudflare Agents Starter example
 */

import {
	convertToModelMessages,
	isStaticToolUIPart,
	type ToolCallOptions,
	type ToolSet,
	type UIMessage,
	type UIMessageStreamWriter,
} from "ai";
import { APPROVAL } from "./shared";

/**
 * Type guard for valid tool names in executions object
 */
function isValidToolName<K extends PropertyKey, T extends object>(
	key: K,
	obj: T,
): key is K & keyof T {
	return key in obj;
}

/**
 * Execution functions for HITL tools
 * Maps tool names to their actual implementation
 */
export type ToolExecutions = Record<
	string,
	// biome-ignore lint/suspicious/noExplicitAny: Tool args vary by tool
	(args: any, context: ToolCallOptions) => Promise<unknown>
>;

/**
 * Processes tool invocations where human input is required, executing tools when authorized.
 * This function handles the server-side execution of HITL tools after user approval.
 *
 * Flow:
 * 1. User triggers a HITL tool (e.g., removeClass)
 * 2. Client shows confirmation UI
 * 3. User approves/denies via addToolResult
 * 4. This function processes the approval and executes the tool if approved
 */
export async function processToolCalls<Tools extends ToolSet>({
	dataStream,
	messages,
	executions,
}: {
	tools: Tools; // used for type inference
	dataStream: UIMessageStreamWriter;
	messages: UIMessage[];
	executions: ToolExecutions;
}): Promise<UIMessage[]> {
	// Process all messages, not just the last one
	const processedMessages = await Promise.all(
		messages.map(async (message) => {
			const parts = message.parts;
			if (!parts) return message;

			const processedParts = await Promise.all(
				parts.map(async (part) => {
					// Only process static tool UI parts (dynamic tools handled separately)
					if (!isStaticToolUIPart(part)) return part;

					const toolName = part.type.replace(
						"tool-",
						"",
					) as keyof typeof executions;

					// Only process tools that require confirmation (are in executions object)
					// and are in 'output-available' state (user has responded)
					if (!(toolName in executions) || part.state !== "output-available")
						return part;

					let result: unknown;

					if (part.output === APPROVAL.YES) {
						// User approved the tool execution
						if (!isValidToolName(toolName, executions)) {
							return part;
						}

						const toolInstance = executions[toolName];
						if (toolInstance) {
							result = await toolInstance(part.input, {
								messages: await convertToModelMessages(messages),
								toolCallId: part.toolCallId,
							});
						} else {
							result = "Error: No execute function found on tool";
						}
					} else if (part.output === APPROVAL.NO) {
						result = "Error: User denied access to tool execution";
					} else {
						// If no approval input yet, leave the part as-is for user interaction
						return part;
					}

					// Forward updated tool result to the client
					dataStream.write({
						type: "tool-output-available",
						toolCallId: part.toolCallId,
						output: result,
					});

					// Return updated tool part with the actual result
					return {
						...part,
						output: result,
					};
				}),
			);

			return { ...message, parts: processedParts };
		}),
	);

	return processedMessages;
}

/**
 * Clean up incomplete tool calls from messages before sending to API
 * Prevents API errors from interrupted or failed tool executions
 *
 * This is critical for stability - without it, the LLM provider may reject
 * requests that contain incomplete tool call states.
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
	return messages.filter((message) => {
		if (!message.parts) return true;

		// Filter out messages with incomplete tool calls
		const hasIncompleteToolCall = message.parts.some((part) => {
			if (!isStaticToolUIPart(part)) return false;
			// Remove tool calls that are still streaming or awaiting input without results
			return (
				part.state === "input-streaming" ||
				(part.state === "input-available" && !part.output && !part.errorText)
			);
		});

		return !hasIncompleteToolCall;
	});
}
