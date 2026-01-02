/**
 * Tool Definitions & Types
 * Common interfaces and types for ClassmateAgent tools
 */
import type { z } from "zod";
import type { ClassRepository } from "../../../domain/repositories/class.repository";
import type { TaskRepository } from "../../../domain/repositories/task.repository";

/**
 * Context passed to tool execution functions
 * Allows tools to access agent state and services
 */
export interface ToolExecutionContext {
	userId: string;
	contextId?: string;
	mode: string;
}

/**
 * Dependencies required for tool creation
 * Injected at runtime from the agent
 */
export interface ToolDependencies {
	userId: string;
	classRepository: ClassRepository;
	taskRepository: TaskRepository;
}

/**
 * Result type for tool executions
 */
export interface ToolResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

/**
 * Metadata for tool definitions
 * Used for registration and HITL identification
 */
export interface ToolMetadata {
	name: string;
	description: string;
	/** If true, tool requires user confirmation before execution (HITL) */
	requiresConfirmation: boolean;
	/** Category for grouping tools by domain */
	category: "class" | "task" | "subject" | "profile" | "general";
}

/**
 * Type helper for tool input schemas
 */
export type ToolInputSchema<T extends z.ZodTypeAny> = T;

/**
 * Available tool names (union type for type safety)
 * Classes: list, get, create, delete, update
 * Tasks: list, get, create, delete, update
 */
export type ClassmateToolName =
	// Class tools
	| "listClasses"
	| "getClass"
	| "createClass"
	| "deleteClass"
	| "updateClass"
	// Task tools
	| "listTasks"
	| "getTask"
	| "createTask"
	| "deleteTask"
	| "updateTask";

/**
 * Mode identifiers
 */
export type AgentMode = "DEFAULT" | "EXAM" | "STUDY" | "REVIEW";

/**
 * Message metadata structure expected from client
 */
export interface ChatMessageMetadata {
	mode?: AgentMode;
	contextId?: string;
	contextType?: "class" | "subject" | "task";
}

/**
 * Agent state stored in Durable Object SQLite
 */
export interface ClassmateAgentState {
	userId: string;
	organizationId?: string;
	currentMode: AgentMode;
	currentContextId?: string;
	createdAt: number;
	lastActiveAt: number;
}

/**
 * Helper to create a successful tool result
 */
export function successResult<T>(data: T): ToolResult<T> {
	return { success: true, data };
}

/**
 * Helper to create an error tool result
 */
export function errorResult(error: string): ToolResult<never> {
	return { success: false, error };
}
