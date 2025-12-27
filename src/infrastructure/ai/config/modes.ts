/**
 * Mode Configuration Manager
 * Manages agent modes, skills (system prompts), and model selection
 */

import type { PromptService } from "../../../domain/services/prompt.service";
import type { AgentMode } from "../tools/definitions";
import {
	getToolsForMode,
	getToolsRequiringConfirmationForMode,
} from "../tools/tool-registry";

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
	/** Path to system prompt file in assets/agents/classmate/ */
	promptPath: string;
	/** Model to use for this mode */
	modelId: ModelId;
	/** Description of what this mode does */
	description: string;
}

/**
 * Mode configurations
 */
const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
	DEFAULT: {
		mode: "DEFAULT",
		displayName: "General Assistant",
		promptPath: "agents/classmate/mode-default.txt",
		modelId: "google/gemini-3-flash",
		description: "General-purpose assistant for all academic tasks",
	},
	EXAM: {
		mode: "EXAM",
		displayName: "Exam Preparation",
		promptPath: "agents/classmate/mode-exam.txt",
		modelId: "google/gemini-3-flash",
		description: "Focused exam preparation and practice questions",
	},
	STUDY: {
		mode: "STUDY",
		displayName: "Study Mode",
		promptPath: "agents/classmate/mode-study.txt",
		modelId: "google/gemini-3-flash",
		description: "Deep learning and concept exploration",
	},
	REVIEW: {
		mode: "REVIEW",
		displayName: "Review Mode",
		promptPath: "agents/classmate/mode-review.txt",
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
	tools: ReturnType<typeof getToolsForMode>;
	toolsRequiringConfirmation: string[];
}

// ============================================
// MODE MANAGER CLASS
// ============================================

/**
 * Manages loading and providing mode configurations
 */
export class ModeManager {
	private promptCache: Map<string, string> = new Map();

	constructor(private readonly promptService: PromptService) {}

	/**
	 * Get the full configuration for a mode
	 * Loads system prompt from assets and prepares tools
	 */
	async getConfiguration(mode: AgentMode): Promise<LoadedModeConfiguration> {
		const config = MODE_CONFIGS[mode] || MODE_CONFIGS.DEFAULT;

		// Load system prompt (with caching)
		let systemPrompt = this.promptCache.get(config.promptPath);
		if (!systemPrompt) {
			systemPrompt = await this.promptService.getPrompt(config.promptPath);
			this.promptCache.set(config.promptPath, systemPrompt);
		}

		// Get tools for this mode
		const tools = getToolsForMode(mode);
		const toolsRequiringConfirmation =
			getToolsRequiringConfirmationForMode(mode);

		return {
			mode: config.mode,
			modelId: config.modelId,
			systemPrompt,
			tools,
			toolsRequiringConfirmation,
		};
	}

	/**
	 * Get mode config without loading prompt (for metadata only)
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
	 * Clear the prompt cache (useful for development)
	 */
	clearCache(): void {
		this.promptCache.clear();
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
