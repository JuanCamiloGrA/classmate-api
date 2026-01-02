/**
 * Skills System Unit Tests
 * Tests for SkillLoader, skill compositions, and skill registry
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: Test file uses any for testing invalid mode types */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptService } from "../../../domain/services/prompt.service";
import {
	BASE_AGENT_SKILLS,
	createSkillLoader,
	DEFAULT_MODE_SKILLS,
	EXAM_MODE_SKILLS,
	MODE_SKILLS_MAP,
	REVIEW_MODE_SKILLS,
	SKILL_REGISTRY,
	type SkillId,
	SkillLoader,
	STUDY_MODE_SKILLS,
} from "./skills";

// ============================================
// MOCK PROMPT SERVICE
// ============================================

function createMockPromptService(
	responses: Record<string, string> = {},
): PromptService {
	return {
		loadPrompt: vi.fn(async () => "Default prompt"),
		getPrompt: vi.fn(async (path: string) => {
			if (responses[path]) {
				return responses[path];
			}
			return `Mock content for: ${path}`;
		}),
	};
}

// ============================================
// SKILL REGISTRY TESTS
// ============================================

describe("SKILL_REGISTRY", () => {
	it("should contain all expected skill categories", () => {
		const categories = new Set(
			Object.values(SKILL_REGISTRY).map((s) => s.category),
		);

		expect(categories.has("tools")).toBe(true);
		expect(categories.has("personalities")).toBe(true);
		expect(categories.has("knowledge")).toBe(true);
		expect(categories.has("modes")).toBe(true);
	});

	it("should have valid paths for all skills", () => {
		for (const skill of Object.values(SKILL_REGISTRY)) {
			expect(skill.path).toMatch(/^agents\/classmate\/skills\//);
			expect(skill.path).toMatch(/\.txt$/);
		}
	});

	it("should have unique IDs for all skills", () => {
		const ids = Object.keys(SKILL_REGISTRY);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("should have multi-tool-calling skill", () => {
		expect(SKILL_REGISTRY["multi-tool-calling"]).toBeDefined();
		expect(SKILL_REGISTRY["multi-tool-calling"].category).toBe("tools");
	});

	it("should have all tool skills", () => {
		expect(SKILL_REGISTRY["multi-tool-calling"]).toBeDefined();
		expect(SKILL_REGISTRY["tool-confirmation"]).toBeDefined();
		expect(SKILL_REGISTRY["tool-error-handling"]).toBeDefined();
	});

	it("should have all personality skills", () => {
		expect(SKILL_REGISTRY["base-personality"]).toBeDefined();
		expect(SKILL_REGISTRY["serious-personality"]).toBeDefined();
		expect(SKILL_REGISTRY["supportive-personality"]).toBeDefined();
	});

	it("should have all knowledge skills", () => {
		expect(SKILL_REGISTRY["memory-palace"]).toBeDefined();
		expect(SKILL_REGISTRY["pedagogy-fundamentals"]).toBeDefined();
		expect(SKILL_REGISTRY["active-recall"]).toBeDefined();
	});

	it("should have all mode skills", () => {
		expect(SKILL_REGISTRY["mode-default"]).toBeDefined();
		expect(SKILL_REGISTRY["mode-exam"]).toBeDefined();
		expect(SKILL_REGISTRY["mode-study"]).toBeDefined();
		expect(SKILL_REGISTRY["mode-review"]).toBeDefined();
	});
});

// ============================================
// SKILL COMPOSITION TESTS
// ============================================

describe("Skill Compositions", () => {
	describe("BASE_AGENT_SKILLS", () => {
		it("should include multi-tool-calling", () => {
			expect(BASE_AGENT_SKILLS).toContain("multi-tool-calling");
		});

		it("should include tool-confirmation", () => {
			expect(BASE_AGENT_SKILLS).toContain("tool-confirmation");
		});

		it("should include tool-error-handling", () => {
			expect(BASE_AGENT_SKILLS).toContain("tool-error-handling");
		});

		it("should have exactly 3 base skills", () => {
			expect(BASE_AGENT_SKILLS).toHaveLength(3);
		});
	});

	describe("DEFAULT_MODE_SKILLS", () => {
		it("should include all base skills", () => {
			for (const skill of BASE_AGENT_SKILLS) {
				expect(DEFAULT_MODE_SKILLS).toContain(skill);
			}
		});

		it("should include base-personality", () => {
			expect(DEFAULT_MODE_SKILLS).toContain("base-personality");
		});

		it("should include mode-default", () => {
			expect(DEFAULT_MODE_SKILLS).toContain("mode-default");
		});
	});

	describe("EXAM_MODE_SKILLS", () => {
		it("should include all base skills", () => {
			for (const skill of BASE_AGENT_SKILLS) {
				expect(EXAM_MODE_SKILLS).toContain(skill);
			}
		});

		it("should include serious-personality for focused exam prep", () => {
			expect(EXAM_MODE_SKILLS).toContain("serious-personality");
		});

		it("should include active-recall for exam practice", () => {
			expect(EXAM_MODE_SKILLS).toContain("active-recall");
		});

		it("should include mode-exam", () => {
			expect(EXAM_MODE_SKILLS).toContain("mode-exam");
		});
	});

	describe("STUDY_MODE_SKILLS", () => {
		it("should include all base skills", () => {
			for (const skill of BASE_AGENT_SKILLS) {
				expect(STUDY_MODE_SKILLS).toContain(skill);
			}
		});

		it("should include supportive-personality for patient learning", () => {
			expect(STUDY_MODE_SKILLS).toContain("supportive-personality");
		});

		it("should include pedagogy-fundamentals", () => {
			expect(STUDY_MODE_SKILLS).toContain("pedagogy-fundamentals");
		});

		it("should include memory-palace technique", () => {
			expect(STUDY_MODE_SKILLS).toContain("memory-palace");
		});

		it("should include mode-study", () => {
			expect(STUDY_MODE_SKILLS).toContain("mode-study");
		});
	});

	describe("REVIEW_MODE_SKILLS", () => {
		it("should include all base skills", () => {
			for (const skill of BASE_AGENT_SKILLS) {
				expect(REVIEW_MODE_SKILLS).toContain(skill);
			}
		});

		it("should include active-recall for review practice", () => {
			expect(REVIEW_MODE_SKILLS).toContain("active-recall");
		});

		it("should include mode-review", () => {
			expect(REVIEW_MODE_SKILLS).toContain("mode-review");
		});

		it("should NOT include heavy knowledge skills for efficiency", () => {
			expect(REVIEW_MODE_SKILLS).not.toContain("memory-palace");
			expect(REVIEW_MODE_SKILLS).not.toContain("pedagogy-fundamentals");
		});
	});

	describe("MODE_SKILLS_MAP", () => {
		it("should have all modes defined", () => {
			expect(MODE_SKILLS_MAP.DEFAULT).toBeDefined();
			expect(MODE_SKILLS_MAP.EXAM).toBeDefined();
			expect(MODE_SKILLS_MAP.STUDY).toBeDefined();
			expect(MODE_SKILLS_MAP.REVIEW).toBeDefined();
		});

		it("should map to correct skill arrays", () => {
			expect(MODE_SKILLS_MAP.DEFAULT).toEqual(DEFAULT_MODE_SKILLS);
			expect(MODE_SKILLS_MAP.EXAM).toEqual(EXAM_MODE_SKILLS);
			expect(MODE_SKILLS_MAP.STUDY).toEqual(STUDY_MODE_SKILLS);
			expect(MODE_SKILLS_MAP.REVIEW).toEqual(REVIEW_MODE_SKILLS);
		});
	});
});

// ============================================
// SKILL LOADER TESTS
// ============================================

describe("SkillLoader", () => {
	let mockPromptService: PromptService;
	let skillLoader: SkillLoader;

	beforeEach(() => {
		mockPromptService = createMockPromptService({
			"agents/classmate/skills/tools/multi-tool-calling.txt":
				"Multi-tool content",
			"agents/classmate/skills/tools/tool-confirmation.txt":
				"Tool confirmation content",
			"agents/classmate/skills/tools/tool-error-handling.txt":
				"Error handling content",
			"agents/classmate/skills/personalities/base-personality.txt":
				"Base personality content",
			"agents/classmate/skills/modes/mode-default.txt": "Default mode content",
		});
		skillLoader = createSkillLoader(mockPromptService);
	});

	describe("loadSkill", () => {
		it("should load a skill by ID", async () => {
			const content = await skillLoader.loadSkill("multi-tool-calling");
			expect(content).toBe("Multi-tool content");
		});

		it("should call promptService with correct path", async () => {
			await skillLoader.loadSkill("multi-tool-calling");
			expect(mockPromptService.getPrompt).toHaveBeenCalledWith(
				"agents/classmate/skills/tools/multi-tool-calling.txt",
			);
		});

		it("should cache loaded skills", async () => {
			await skillLoader.loadSkill("multi-tool-calling");
			await skillLoader.loadSkill("multi-tool-calling");

			// Should only call getPrompt once due to caching
			expect(mockPromptService.getPrompt).toHaveBeenCalledTimes(1);
		});

		it("should throw error for unknown skill ID", async () => {
			await expect(
				skillLoader.loadSkill("unknown-skill" as SkillId),
			).rejects.toThrow("Unknown skill: unknown-skill");
		});
	});

	describe("composeSkills", () => {
		it("should compose multiple skills into a single prompt", async () => {
			const composed = await skillLoader.composeSkills([
				"multi-tool-calling",
				"base-personality",
			]);

			expect(composed).toContain("Multi-tool content");
			expect(composed).toContain("Base personality content");
		});

		it("should separate skill sections with dividers", async () => {
			const composed = await skillLoader.composeSkills([
				"multi-tool-calling",
				"base-personality",
			]);

			// Skills from different categories should be separated
			expect(composed).toContain("---");
		});

		it("should handle empty skill array", async () => {
			const composed = await skillLoader.composeSkills([]);
			expect(composed).toBe("");
		});

		it("should load all skills in parallel", async () => {
			await skillLoader.composeSkills([
				"multi-tool-calling",
				"tool-confirmation",
				"base-personality",
			]);

			expect(mockPromptService.getPrompt).toHaveBeenCalledTimes(3);
		});
	});

	describe("getSystemPromptForMode", () => {
		it("should return composed prompt for DEFAULT mode", async () => {
			const prompt = await skillLoader.getSystemPromptForMode("DEFAULT");

			expect(prompt).toContain("Multi-tool content");
			expect(prompt).toContain("Base personality content");
			expect(prompt).toContain("Default mode content");
		});

		it("should use cached skills across modes", async () => {
			await skillLoader.getSystemPromptForMode("DEFAULT");
			const callsAfterFirst = (
				mockPromptService.getPrompt as ReturnType<typeof vi.fn>
			).mock.calls.length;

			// Load EXAM mode which shares some skills
			await skillLoader.getSystemPromptForMode("EXAM");

			// Base skills should be cached, so fewer new calls
			const callsAfterSecond = (
				mockPromptService.getPrompt as ReturnType<typeof vi.fn>
			).mock.calls.length;

			// EXAM mode has unique skills (serious-personality, active-recall, mode-exam)
			// but base skills should be cached
			expect(callsAfterSecond - callsAfterFirst).toBeLessThan(
				EXAM_MODE_SKILLS.length,
			);
		});
	});

	describe("getSkillsForMode", () => {
		it("should return correct skills for DEFAULT mode", () => {
			const skills = skillLoader.getSkillsForMode("DEFAULT");
			expect(skills).toEqual(DEFAULT_MODE_SKILLS);
		});

		it("should return correct skills for EXAM mode", () => {
			const skills = skillLoader.getSkillsForMode("EXAM");
			expect(skills).toEqual(EXAM_MODE_SKILLS);
		});

		it("should return correct skills for STUDY mode", () => {
			const skills = skillLoader.getSkillsForMode("STUDY");
			expect(skills).toEqual(STUDY_MODE_SKILLS);
		});

		it("should return correct skills for REVIEW mode", () => {
			const skills = skillLoader.getSkillsForMode("REVIEW");
			expect(skills).toEqual(REVIEW_MODE_SKILLS);
		});

		it("should default to DEFAULT skills for unknown mode", () => {
			const skills = skillLoader.getSkillsForMode("UNKNOWN" as any);
			expect(skills).toEqual(DEFAULT_MODE_SKILLS);
		});
	});

	describe("getAllSkills", () => {
		it("should return all registered skills", () => {
			const allSkills = skillLoader.getAllSkills();
			expect(allSkills.length).toBe(Object.keys(SKILL_REGISTRY).length);
		});

		it("should include skills from all categories", () => {
			const allSkills = skillLoader.getAllSkills();
			const categories = new Set(allSkills.map((s) => s.category));

			expect(categories.has("tools")).toBe(true);
			expect(categories.has("personalities")).toBe(true);
			expect(categories.has("knowledge")).toBe(true);
			expect(categories.has("modes")).toBe(true);
		});
	});

	describe("getSkillsByCategory", () => {
		it("should return only tools skills", () => {
			const toolSkills = skillLoader.getSkillsByCategory("tools");
			expect(toolSkills.every((s) => s.category === "tools")).toBe(true);
			expect(toolSkills.length).toBe(3);
		});

		it("should return only personality skills", () => {
			const personalitySkills =
				skillLoader.getSkillsByCategory("personalities");
			expect(
				personalitySkills.every((s) => s.category === "personalities"),
			).toBe(true);
			expect(personalitySkills.length).toBe(3);
		});

		it("should return only knowledge skills", () => {
			const knowledgeSkills = skillLoader.getSkillsByCategory("knowledge");
			expect(knowledgeSkills.every((s) => s.category === "knowledge")).toBe(
				true,
			);
			expect(knowledgeSkills.length).toBe(3);
		});

		it("should return only mode skills", () => {
			const modeSkills = skillLoader.getSkillsByCategory("modes");
			expect(modeSkills.every((s) => s.category === "modes")).toBe(true);
			expect(modeSkills.length).toBe(4);
		});
	});

	describe("clearCache", () => {
		it("should clear cached skills", async () => {
			await skillLoader.loadSkill("multi-tool-calling");
			skillLoader.clearCache();
			await skillLoader.loadSkill("multi-tool-calling");

			// Should call getPrompt twice since cache was cleared
			expect(mockPromptService.getPrompt).toHaveBeenCalledTimes(2);
		});
	});
});

// ============================================
// FACTORY FUNCTION TESTS
// ============================================

describe("createSkillLoader", () => {
	it("should create a SkillLoader instance", () => {
		const mockPromptService = createMockPromptService();
		const loader = createSkillLoader(mockPromptService);

		expect(loader).toBeInstanceOf(SkillLoader);
	});

	it("should use provided prompt service", async () => {
		const mockPromptService = createMockPromptService({
			"agents/classmate/skills/tools/multi-tool-calling.txt": "Custom content",
		});
		const loader = createSkillLoader(mockPromptService);

		const content = await loader.loadSkill("multi-tool-calling");
		expect(content).toBe("Custom content");
	});
});
