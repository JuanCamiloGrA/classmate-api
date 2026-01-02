/**
 * Mode Configuration Manager
 * Manages agent modes, skills composition, and model selection
 */

import type { PromptService } from "../../../domain/services/prompt.service";
import type { AgentMode, ToolDependencies } from "../tools/definitions";
import {
	getToolsForMode,
	getToolsRequiringConfirmationForMode,
} from "../tools/tool-registry";
import {
	createSkillLoader,
	MODE_SKILLS_MAP,
	type SkillId,
	type SkillLoader,
} from "./skills";

// ============================================
// MODEL CONFIGURATION
// ============================================

/** Supported AI models via AI Gateway */
export type ModelId =
	| "google/gemini-3-flash"
	| "google/gemini-2.5-flash-lite"
	| "xai/grok-4.1-fast-reasoning";

/** Default model for ClassmateAgent */
export const DEFAULT_MODEL: ModelId = "google/gemini-3-flash";

// ============================================
// MODE DEFINITIONS
// ============================================

export interface ModeConfig {
	/** Unique mode identifier */
	mode: AgentMode;
	/** Display name for the mode */
	displayName: string;
	/** Skills to compose into system prompt */
	skills: SkillId[];
	/** Model to use for this mode */
	modelId: ModelId;
	/** Description of what this mode does */
	description: string;
}

/**
 * Mode configurations with skills composition
 */
const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
	DEFAULT: {
		mode: "DEFAULT",
		displayName: "General Assistant",
		skills: MODE_SKILLS_MAP.DEFAULT,
		modelId: "google/gemini-3-flash",
		description: "General-purpose assistant for all academic tasks",
	},
	EXAM: {
		mode: "EXAM",
		displayName: "Exam Preparation",
		skills: MODE_SKILLS_MAP.EXAM,
		modelId: "google/gemini-3-flash",
		description: "Focused exam preparation and practice questions",
	},
	STUDY: {
		mode: "STUDY",
		displayName: "Study Mode",
		skills: MODE_SKILLS_MAP.STUDY,
		modelId: "google/gemini-3-flash",
		description: "Deep learning and concept exploration",
	},
	REVIEW: {
		mode: "REVIEW",
		displayName: "Review Mode",
		skills: MODE_SKILLS_MAP.REVIEW,
		modelId: "google/gemini-2.5-flash-lite", // Lighter model for review
		description: "Quick review and summarization of content",
	},
};

// ============================================
// LOADED CONFIGURATION
// ============================================

export interface LoadedModeConfiguration {
	mode: AgentMode;
	modelId: ModelId;
	systemPrompt: string;
	skills: SkillId[];
	tools: ReturnType<typeof getToolsForMode>;
	toolsRequiringConfirmation: string[];
}

// ============================================
// MODE MANAGER CLASS
// ============================================

/**
 * Manages loading and providing mode configurations
 * Uses SkillLoader to compose skills into system prompts
 */
export class ModeManager {
	private skillLoader: SkillLoader;

	constructor(promptService: PromptService) {
		this.skillLoader = createSkillLoader(promptService);
	}

	/**
	 * Get the full configuration for a mode
	 * Composes skills into system prompt and prepares tools
	 *
	 * @param mode - The agent mode to load configuration for
	 * @param deps - Tool dependencies (userId, repositories)
	 */
	async getConfiguration(
		mode: AgentMode,
		deps: ToolDependencies,
	): Promise<LoadedModeConfiguration> {
		const config = MODE_CONFIGS[mode] || MODE_CONFIGS.DEFAULT;

		// Compose skills into system prompt
		const systemPrompt = await this.skillLoader.getSystemPromptForMode(mode);

		// Get tools for this mode with injected dependencies
		const tools = getToolsForMode(mode, deps);
		const toolsRequiringConfirmation =
			getToolsRequiringConfirmationForMode(mode);

		return {
			mode: config.mode,
			modelId: config.modelId,
			systemPrompt,
			skills: config.skills,
			tools,
			toolsRequiringConfirmation,
		};
	}

	/**
	 * Get mode config without loading prompts (for metadata only)
	 */
	getModeConfig(mode: AgentMode): ModeConfig {
		return MODE_CONFIGS[mode] || MODE_CONFIGS.DEFAULT;
	}

	/**
	 * Get all available modes
	 */
	getAvailableModes(): ModeConfig[] {
		return Object.values(MODE_CONFIGS);
	}

	/**
	 * Check if a mode is valid
	 */
	isValidMode(mode: string): mode is AgentMode {
		return mode in MODE_CONFIGS;
	}

	/**
	 * Get skills for a specific mode
	 */
	getSkillsForMode(mode: AgentMode): SkillId[] {
		return MODE_SKILLS_MAP[mode] || MODE_SKILLS_MAP.DEFAULT;
	}

	/**
	 * Clear the skill cache (useful for development)
	 */
	clearCache(): void {
		this.skillLoader.clearCache();
	}
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create a ModeManager instance
 */
export function createModeManager(promptService: PromptService): ModeManager {
	return new ModeManager(promptService);
}

// ============================================
// EXPORTS
// ============================================

export { MODE_CONFIGS };

// Re-export skill types for convenience
export type { SkillId, SkillLoader };
export { BASE_AGENT_SKILLS, MODE_SKILLS_MAP } from "./skills";
