/**
 * Skills Configuration
 * Composable skill fragments that can be combined to create system prompts
 *
 * Skills are organized into categories:
 * - tools: Tool usage and behavior instructions
 * - personalities: Agent personality traits
 * - knowledge: Domain knowledge and techniques
 * - modes: Mode-specific behavior overrides
 */

import type { PromptService } from "../../../domain/services/prompt.service";
import type { AgentMode } from "../tools/definitions";

// ============================================
// SKILL DEFINITIONS
// ============================================

/** Skill category for organization */
export type SkillCategory = "tools" | "personalities" | "knowledge" | "modes";

/** Individual skill identifier */
export type SkillId =
	// Tool skills
	| "multi-tool-calling"
	| "tool-confirmation"
	| "tool-error-handling"
	// Personality skills
	| "base-personality"
	| "serious-personality"
	| "supportive-personality"
	// Knowledge skills
	| "memory-palace"
	| "pedagogy-fundamentals"
	| "active-recall"
	// Mode-specific skills
	| "mode-default"
	| "mode-exam"
	| "mode-study"
	| "mode-review";

/** Skill metadata and path mapping */
export interface SkillDefinition {
	id: SkillId;
	category: SkillCategory;
	name: string;
	description: string;
	/** Path relative to assets/agents/classmate/ */
	path: string;
}

// ============================================
// SKILL REGISTRY
// ============================================

/**
 * Central registry of all available skills
 */
/** Base path for all skill assets */
const SKILLS_BASE = "agents/classmate/skills";

export const SKILL_REGISTRY: Record<SkillId, SkillDefinition> = {
	// Tool Skills
	"multi-tool-calling": {
		id: "multi-tool-calling",
		category: "tools",
		name: "Multi Tool Calling",
		description: "Instructions for parallel tool execution",
		path: `${SKILLS_BASE}/tools/multi-tool-calling.txt`,
	},
	"tool-confirmation": {
		id: "tool-confirmation",
		category: "tools",
		name: "Tool Confirmation",
		description: "Guidelines for HITL tool confirmations",
		path: `${SKILLS_BASE}/tools/tool-confirmation.txt`,
	},
	"tool-error-handling": {
		id: "tool-error-handling",
		category: "tools",
		name: "Tool Error Handling",
		description: "How to handle and communicate tool errors",
		path: `${SKILLS_BASE}/tools/tool-error-handling.txt`,
	},

	// Personality Skills
	"base-personality": {
		id: "base-personality",
		category: "personalities",
		name: "Classmate Base Personality",
		description: "Core personality traits and response style",
		path: `${SKILLS_BASE}/personalities/base-personality.txt`,
	},
	"serious-personality": {
		id: "serious-personality",
		category: "personalities",
		name: "Serious Personality",
		description: "Professional and focused demeanor",
		path: `${SKILLS_BASE}/personalities/serious-personality.txt`,
	},
	"supportive-personality": {
		id: "supportive-personality",
		category: "personalities",
		name: "Supportive Friend Personality",
		description: "Emotional support and encouragement",
		path: `${SKILLS_BASE}/personalities/supportive-personality.txt`,
	},

	// Knowledge Skills
	"memory-palace": {
		id: "memory-palace",
		category: "knowledge",
		name: "Memory Palace Technique",
		description: "Personalized memory palace construction",
		path: `${SKILLS_BASE}/knowledge/memory-palace.txt`,
	},
	"pedagogy-fundamentals": {
		id: "pedagogy-fundamentals",
		category: "knowledge",
		name: "Pedagogy Fundamentals",
		description: "Advanced pedagogical techniques",
		path: `${SKILLS_BASE}/knowledge/pedagogy-fundamentals.txt`,
	},
	"active-recall": {
		id: "active-recall",
		category: "knowledge",
		name: "Active Recall Techniques",
		description: "Spaced repetition and recall methods",
		path: `${SKILLS_BASE}/knowledge/active-recall.txt`,
	},

	// Mode-Specific Skills
	"mode-default": {
		id: "mode-default",
		category: "modes",
		name: "Default Mode Behavior",
		description: "General assistant behavior",
		path: `${SKILLS_BASE}/modes/mode-default.txt`,
	},
	"mode-exam": {
		id: "mode-exam",
		category: "modes",
		name: "Exam Mode Behavior",
		description: "Exam preparation focus",
		path: `${SKILLS_BASE}/modes/mode-exam.txt`,
	},
	"mode-study": {
		id: "mode-study",
		category: "modes",
		name: "Study Mode Behavior",
		description: "Deep learning focus",
		path: `${SKILLS_BASE}/modes/mode-study.txt`,
	},
	"mode-review": {
		id: "mode-review",
		category: "modes",
		name: "Review Mode Behavior",
		description: "Quick review and consolidation",
		path: `${SKILLS_BASE}/modes/mode-review.txt`,
	},
};

// ============================================
// SKILL COMPOSITIONS
// ============================================

/**
 * Base skills shared by all agent modes
 * These provide fundamental capabilities
 */
export const BASE_AGENT_SKILLS: SkillId[] = [
	"multi-tool-calling",
	"tool-confirmation",
	"tool-error-handling",
];

/**
 * Default mode skill composition
 * General-purpose assistant with base personality
 */
export const DEFAULT_MODE_SKILLS: SkillId[] = [
	...BASE_AGENT_SKILLS,
	"base-personality",
	"mode-default",
];

/**
 * Exam mode skill composition
 * Focused, efficient, exam-oriented
 */
export const EXAM_MODE_SKILLS: SkillId[] = [
	...BASE_AGENT_SKILLS,
	"base-personality",
	"serious-personality",
	"active-recall",
	"mode-exam",
];

/**
 * Study mode skill composition
 * Patient, thorough, supportive
 */
export const STUDY_MODE_SKILLS: SkillId[] = [
	...BASE_AGENT_SKILLS,
	"base-personality",
	"supportive-personality",
	"pedagogy-fundamentals",
	"memory-palace",
	"mode-study",
];

/**
 * Review mode skill composition
 * Efficient, concise, recap-focused
 */
export const REVIEW_MODE_SKILLS: SkillId[] = [
	...BASE_AGENT_SKILLS,
	"base-personality",
	"active-recall",
	"mode-review",
];

/**
 * Maps agent modes to their skill compositions
 */
export const MODE_SKILLS_MAP: Record<AgentMode, SkillId[]> = {
	DEFAULT: DEFAULT_MODE_SKILLS,
	EXAM: EXAM_MODE_SKILLS,
	STUDY: STUDY_MODE_SKILLS,
	REVIEW: REVIEW_MODE_SKILLS,
};

// ============================================
// SKILL LOADER CLASS
// ============================================

/**
 * Loads and composes skills into system prompts
 */
export class SkillLoader {
	private cache: Map<SkillId, string> = new Map();

	constructor(private readonly promptService: PromptService) {}

	/**
	 * Load a single skill content
	 */
	async loadSkill(skillId: SkillId): Promise<string> {
		// Check cache first
		const cached = this.cache.get(skillId);
		if (cached) return cached;

		const definition = SKILL_REGISTRY[skillId];
		if (!definition) {
			throw new Error(`Unknown skill: ${skillId}`);
		}

		const content = await this.promptService.getPrompt(definition.path);
		this.cache.set(skillId, content);
		return content;
	}

	/**
	 * Load multiple skills and compose them into a single prompt
	 */
	async composeSkills(skillIds: SkillId[]): Promise<string> {
		const contents = await Promise.all(
			skillIds.map((id) => this.loadSkill(id)),
		);

		return this.formatComposedPrompt(skillIds, contents);
	}

	/**
	 * Get composed system prompt for a specific mode
	 */
	async getSystemPromptForMode(mode: AgentMode): Promise<string> {
		const skills = MODE_SKILLS_MAP[mode] || MODE_SKILLS_MAP.DEFAULT;
		return this.composeSkills(skills);
	}

	/**
	 * Format skill contents into a coherent system prompt
	 */
	private formatComposedPrompt(
		skillIds: SkillId[],
		contents: string[],
	): string {
		const sections: string[] = [];

		// Group skills by category for organized output
		const grouped = this.groupSkillsByCategory(skillIds, contents);

		// Add each category section
		for (const [_category, skills] of Object.entries(grouped)) {
			if (skills.length > 0) {
				const categoryContent = skills.join("\n\n");
				sections.push(categoryContent);
			}
		}

		return sections.join("\n\n---\n\n");
	}

	/**
	 * Group skills by their category for organized composition
	 */
	private groupSkillsByCategory(
		skillIds: SkillId[],
		contents: string[],
	): Record<SkillCategory, string[]> {
		const grouped: Record<SkillCategory, string[]> = {
			personalities: [],
			modes: [],
			knowledge: [],
			tools: [],
		};

		for (let i = 0; i < skillIds.length; i++) {
			const skillId = skillIds[i];
			const content = contents[i];
			const definition = SKILL_REGISTRY[skillId];

			if (definition && content) {
				grouped[definition.category].push(content);
			}
		}

		return grouped;
	}

	/**
	 * Get skills for a mode
	 */
	getSkillsForMode(mode: AgentMode): SkillId[] {
		return MODE_SKILLS_MAP[mode] || MODE_SKILLS_MAP.DEFAULT;
	}

	/**
	 * Get all available skills
	 */
	getAllSkills(): SkillDefinition[] {
		return Object.values(SKILL_REGISTRY);
	}

	/**
	 * Get skills by category
	 */
	getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
		return Object.values(SKILL_REGISTRY).filter(
			(skill) => skill.category === category,
		);
	}

	/**
	 * Clear the skill cache
	 */
	clearCache(): void {
		this.cache.clear();
	}
}

/**
 * Factory function to create a SkillLoader
 */
export function createSkillLoader(promptService: PromptService): SkillLoader {
	return new SkillLoader(promptService);
}
