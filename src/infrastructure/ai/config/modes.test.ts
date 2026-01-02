/**
 * ModeManager Unit Tests
 * Tests for ModeManager with skills integration
 */
/** biome-ignore-all lint/suspicious/noExplicitAny: Test file uses any for testing invalid mode types */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClassRepository } from "../../../domain/repositories/class.repository";
import type { TaskRepository } from "../../../domain/repositories/task.repository";
import type { PromptService } from "../../../domain/services/prompt.service";
import type { ToolDependencies } from "../tools/definitions";
import { createModeManager, MODE_CONFIGS, ModeManager } from "./modes";
import { MODE_SKILLS_MAP } from "./skills";

// ============================================
// MOCK FACTORIES
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

function createMockClassRepository(): ClassRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		hardDelete: vi.fn(),
	};
}

function createMockTaskRepository(): TaskRepository {
	return {
		create: vi.fn(),
		findByIdAndUserId: vi.fn(),
		findBySubjectIdAndUserId: vi.fn(),
		findAll: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		hardDelete: vi.fn(),
	};
}

function createMockDependencies(): ToolDependencies {
	return {
		userId: "test-user-id",
		classRepository: createMockClassRepository(),
		taskRepository: createMockTaskRepository(),
	};
}

// ============================================
// MODE_CONFIGS TESTS
// ============================================

describe("MODE_CONFIGS", () => {
	it("should have all four modes defined", () => {
		expect(MODE_CONFIGS.DEFAULT).toBeDefined();
		expect(MODE_CONFIGS.EXAM).toBeDefined();
		expect(MODE_CONFIGS.STUDY).toBeDefined();
		expect(MODE_CONFIGS.REVIEW).toBeDefined();
	});

	it("should have skills array for each mode", () => {
		for (const config of Object.values(MODE_CONFIGS)) {
			expect(Array.isArray(config.skills)).toBe(true);
			expect(config.skills.length).toBeGreaterThan(0);
		}
	});

	it("should reference correct skill compositions", () => {
		expect(MODE_CONFIGS.DEFAULT.skills).toEqual(MODE_SKILLS_MAP.DEFAULT);
		expect(MODE_CONFIGS.EXAM.skills).toEqual(MODE_SKILLS_MAP.EXAM);
		expect(MODE_CONFIGS.STUDY.skills).toEqual(MODE_SKILLS_MAP.STUDY);
		expect(MODE_CONFIGS.REVIEW.skills).toEqual(MODE_SKILLS_MAP.REVIEW);
	});

	it("should have valid modelIds for each mode", () => {
		const validModels = [
			"google/gemini-3-flash",
			"google/gemini-2.5-flash-lite",
			"xai/grok-4.1-fast-reasoning",
		];

		for (const config of Object.values(MODE_CONFIGS)) {
			expect(validModels).toContain(config.modelId);
		}
	});

	it("should use lighter model for REVIEW mode", () => {
		expect(MODE_CONFIGS.REVIEW.modelId).toBe("google/gemini-2.5-flash-lite");
	});

	it("should have displayName and description for each mode", () => {
		for (const config of Object.values(MODE_CONFIGS)) {
			expect(config.displayName).toBeTruthy();
			expect(config.description).toBeTruthy();
		}
	});
});

// ============================================
// MODE MANAGER TESTS
// ============================================

describe("ModeManager", () => {
	let mockPromptService: PromptService;
	let mockDeps: ToolDependencies;
	let modeManager: ModeManager;

	beforeEach(() => {
		mockPromptService = createMockPromptService({
			"agents/classmate/skills/tools/multi-tool-calling.txt":
				"## Multi Tool Calling\n\nContent",
			"agents/classmate/skills/tools/tool-confirmation.txt":
				"## Tool Confirmation\n\nContent",
			"agents/classmate/skills/tools/tool-error-handling.txt":
				"## Error Handling\n\nContent",
			"agents/classmate/skills/personalities/base-personality.txt":
				"## Base Personality\n\nContent",
			"agents/classmate/skills/personalities/serious-personality.txt":
				"## Serious Personality\n\nContent",
			"agents/classmate/skills/personalities/supportive-personality.txt":
				"## Supportive Personality\n\nContent",
			"agents/classmate/skills/knowledge/memory-palace.txt":
				"## Memory Palace\n\nContent",
			"agents/classmate/skills/knowledge/pedagogy-fundamentals.txt":
				"## Pedagogy Fundamentals\n\nContent",
			"agents/classmate/skills/knowledge/active-recall.txt":
				"## Active Recall\n\nContent",
			"agents/classmate/skills/modes/mode-default.txt":
				"## Default Mode\n\nContent",
			"agents/classmate/skills/modes/mode-exam.txt": "## Exam Mode\n\nContent",
			"agents/classmate/skills/modes/mode-study.txt":
				"## Study Mode\n\nContent",
			"agents/classmate/skills/modes/mode-review.txt":
				"## Review Mode\n\nContent",
		});
		mockDeps = createMockDependencies();
		modeManager = createModeManager(mockPromptService);
	});

	describe("getConfiguration", () => {
		it("should return configuration for DEFAULT mode", async () => {
			const config = await modeManager.getConfiguration("DEFAULT", mockDeps);

			expect(config.mode).toBe("DEFAULT");
			expect(config.modelId).toBe("google/gemini-3-flash");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.DEFAULT);
			expect(config.systemPrompt).toBeTruthy();
			expect(config.tools).toBeDefined();
			expect(config.toolsRequiringConfirmation).toBeDefined();
		});

		it("should return configuration for EXAM mode", async () => {
			const config = await modeManager.getConfiguration("EXAM", mockDeps);

			expect(config.mode).toBe("EXAM");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.EXAM);
			expect(config.systemPrompt).toContain("Exam Mode");
			expect(config.systemPrompt).toContain("Serious Personality");
			expect(config.systemPrompt).toContain("Active Recall");
		});

		it("should return configuration for STUDY mode", async () => {
			const config = await modeManager.getConfiguration("STUDY", mockDeps);

			expect(config.mode).toBe("STUDY");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.STUDY);
			expect(config.systemPrompt).toContain("Study Mode");
			expect(config.systemPrompt).toContain("Supportive Personality");
			expect(config.systemPrompt).toContain("Memory Palace");
			expect(config.systemPrompt).toContain("Pedagogy Fundamentals");
		});

		it("should return configuration for REVIEW mode", async () => {
			const config = await modeManager.getConfiguration("REVIEW", mockDeps);

			expect(config.mode).toBe("REVIEW");
			expect(config.modelId).toBe("google/gemini-2.5-flash-lite");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.REVIEW);
			expect(config.systemPrompt).toContain("Review Mode");
			expect(config.systemPrompt).toContain("Active Recall");
		});

		it("should include multi-tool-calling in all mode prompts", async () => {
			const modes = ["DEFAULT", "EXAM", "STUDY", "REVIEW"] as const;

			for (const mode of modes) {
				const config = await modeManager.getConfiguration(mode, mockDeps);
				expect(config.systemPrompt).toContain("Multi Tool Calling");
			}
		});

		it("should include base-personality in all mode prompts", async () => {
			const modes = ["DEFAULT", "EXAM", "STUDY", "REVIEW"] as const;

			for (const mode of modes) {
				const config = await modeManager.getConfiguration(mode, mockDeps);
				expect(config.systemPrompt).toContain("Base Personality");
			}
		});

		it("should default to DEFAULT config for unknown mode", async () => {
			const config = await modeManager.getConfiguration(
				"UNKNOWN" as any,
				mockDeps,
			);

			expect(config.mode).toBe("DEFAULT");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.DEFAULT);
		});

		it("should return tools for the mode", async () => {
			const config = await modeManager.getConfiguration("DEFAULT", mockDeps);

			expect(typeof config.tools).toBe("object");
		});

		it("should return tools requiring confirmation", async () => {
			const config = await modeManager.getConfiguration("DEFAULT", mockDeps);

			expect(Array.isArray(config.toolsRequiringConfirmation)).toBe(true);
		});
	});

	describe("getModeConfig", () => {
		it("should return mode config without loading prompts", () => {
			const config = modeManager.getModeConfig("DEFAULT");

			expect(config.mode).toBe("DEFAULT");
			expect(config.skills).toEqual(MODE_SKILLS_MAP.DEFAULT);
			// getPrompt should not have been called
			expect(mockPromptService.getPrompt).not.toHaveBeenCalled();
		});

		it("should return config for all modes", () => {
			const modes = ["DEFAULT", "EXAM", "STUDY", "REVIEW"] as const;

			for (const mode of modes) {
				const config = modeManager.getModeConfig(mode);
				expect(config.mode).toBe(mode);
			}
		});

		it("should default to DEFAULT for unknown mode", () => {
			const config = modeManager.getModeConfig("UNKNOWN" as any);
			expect(config.mode).toBe("DEFAULT");
		});
	});

	describe("getAvailableModes", () => {
		it("should return all 4 modes", () => {
			const modes = modeManager.getAvailableModes();
			expect(modes).toHaveLength(4);
		});

		it("should include all mode types", () => {
			const modes = modeManager.getAvailableModes();
			const modeNames = modes.map((m) => m.mode);

			expect(modeNames).toContain("DEFAULT");
			expect(modeNames).toContain("EXAM");
			expect(modeNames).toContain("STUDY");
			expect(modeNames).toContain("REVIEW");
		});
	});

	describe("isValidMode", () => {
		it("should return true for valid modes", () => {
			expect(modeManager.isValidMode("DEFAULT")).toBe(true);
			expect(modeManager.isValidMode("EXAM")).toBe(true);
			expect(modeManager.isValidMode("STUDY")).toBe(true);
			expect(modeManager.isValidMode("REVIEW")).toBe(true);
		});

		it("should return false for invalid modes", () => {
			expect(modeManager.isValidMode("INVALID")).toBe(false);
			expect(modeManager.isValidMode("default")).toBe(false);
			expect(modeManager.isValidMode("")).toBe(false);
		});
	});

	describe("getSkillsForMode", () => {
		it("should return skills for each mode", () => {
			expect(modeManager.getSkillsForMode("DEFAULT")).toEqual(
				MODE_SKILLS_MAP.DEFAULT,
			);
			expect(modeManager.getSkillsForMode("EXAM")).toEqual(
				MODE_SKILLS_MAP.EXAM,
			);
			expect(modeManager.getSkillsForMode("STUDY")).toEqual(
				MODE_SKILLS_MAP.STUDY,
			);
			expect(modeManager.getSkillsForMode("REVIEW")).toEqual(
				MODE_SKILLS_MAP.REVIEW,
			);
		});

		it("should default to DEFAULT skills for unknown mode", () => {
			expect(modeManager.getSkillsForMode("UNKNOWN" as any)).toEqual(
				MODE_SKILLS_MAP.DEFAULT,
			);
		});
	});

	describe("clearCache", () => {
		it("should clear skill cache", async () => {
			// Load configuration to populate cache
			await modeManager.getConfiguration("DEFAULT", mockDeps);
			const callsAfterFirst = (
				mockPromptService.getPrompt as ReturnType<typeof vi.fn>
			).mock.calls.length;

			// Clear cache and load again
			modeManager.clearCache();
			await modeManager.getConfiguration("DEFAULT", mockDeps);
			const callsAfterSecond = (
				mockPromptService.getPrompt as ReturnType<typeof vi.fn>
			).mock.calls.length;

			// Should have made new calls after cache clear
			expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);
		});
	});
});

// ============================================
// FACTORY FUNCTION TESTS
// ============================================

describe("createModeManager", () => {
	it("should create a ModeManager instance", () => {
		const mockPromptService = createMockPromptService();
		const manager = createModeManager(mockPromptService);

		expect(manager).toBeInstanceOf(ModeManager);
	});

	it("should use provided prompt service for skill loading", async () => {
		const mockPromptService = createMockPromptService({
			"agents/classmate/skills/tools/multi-tool-calling.txt":
				"Custom multi-tool content",
			"agents/classmate/skills/tools/tool-confirmation.txt":
				"Custom confirmation",
			"agents/classmate/skills/tools/tool-error-handling.txt":
				"Custom error handling",
			"agents/classmate/skills/personalities/base-personality.txt":
				"Custom personality",
			"agents/classmate/skills/modes/mode-default.txt": "Custom default mode",
		});
		const mockDeps = createMockDependencies();
		const manager = createModeManager(mockPromptService);

		const config = await manager.getConfiguration("DEFAULT", mockDeps);
		expect(config.systemPrompt).toContain("Custom multi-tool content");
	});
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Skills System Integration", () => {
	let modeManager: ModeManager;
	let mockDeps: ToolDependencies;

	beforeEach(() => {
		const mockPromptService = createMockPromptService({
			"agents/classmate/skills/tools/multi-tool-calling.txt":
				"You can call multiple tools in parallel.",
			"agents/classmate/skills/tools/tool-confirmation.txt":
				"Some tools require confirmation.",
			"agents/classmate/skills/tools/tool-error-handling.txt":
				"Handle errors gracefully.",
			"agents/classmate/skills/personalities/base-personality.txt":
				"You are Classmate, an academic assistant.",
			"agents/classmate/skills/personalities/serious-personality.txt":
				"Be direct and efficient.",
			"agents/classmate/skills/personalities/supportive-personality.txt":
				"Be patient and encouraging.",
			"agents/classmate/skills/knowledge/memory-palace.txt":
				"Guide students through memory palace construction.",
			"agents/classmate/skills/knowledge/pedagogy-fundamentals.txt":
				"Apply research-backed teaching strategies.",
			"agents/classmate/skills/knowledge/active-recall.txt":
				"Use retrieval practice for better learning.",
			"agents/classmate/skills/modes/mode-default.txt":
				"General academic assistance mode.",
			"agents/classmate/skills/modes/mode-exam.txt": "Exam preparation mode.",
			"agents/classmate/skills/modes/mode-study.txt": "Deep learning mode.",
			"agents/classmate/skills/modes/mode-review.txt": "Quick review mode.",
		});
		mockDeps = createMockDependencies();
		modeManager = createModeManager(mockPromptService);
	});

	it("should compose DEFAULT mode with correct skills", async () => {
		const config = await modeManager.getConfiguration("DEFAULT", mockDeps);

		// Should have tool skills
		expect(config.systemPrompt).toContain("multiple tools in parallel");
		expect(config.systemPrompt).toContain("require confirmation");
		expect(config.systemPrompt).toContain("Handle errors");

		// Should have base personality
		expect(config.systemPrompt).toContain("Classmate");

		// Should have mode-specific behavior
		expect(config.systemPrompt).toContain("General academic assistance");

		// Should NOT have exam/study/review specific content
		expect(config.systemPrompt).not.toContain("Exam preparation mode");
		expect(config.systemPrompt).not.toContain("Deep learning mode");
	});

	it("should compose EXAM mode with focused skills", async () => {
		const config = await modeManager.getConfiguration("EXAM", mockDeps);

		// Should have tool skills (base)
		expect(config.systemPrompt).toContain("multiple tools in parallel");

		// Should have serious personality (not supportive)
		expect(config.systemPrompt).toContain("direct and efficient");
		expect(config.systemPrompt).not.toContain("patient and encouraging");

		// Should have active recall
		expect(config.systemPrompt).toContain("retrieval practice");

		// Should NOT have memory palace (heavy for exam prep)
		expect(config.systemPrompt).not.toContain("memory palace");
	});

	it("should compose STUDY mode with deep learning skills", async () => {
		const config = await modeManager.getConfiguration("STUDY", mockDeps);

		// Should have supportive personality (not serious)
		expect(config.systemPrompt).toContain("patient and encouraging");
		expect(config.systemPrompt).not.toContain("direct and efficient");

		// Should have pedagogy and memory palace
		expect(config.systemPrompt).toContain("research-backed teaching");
		expect(config.systemPrompt).toContain("memory palace");
	});

	it("should compose REVIEW mode with efficient skills", async () => {
		const config = await modeManager.getConfiguration("REVIEW", mockDeps);

		// Should have active recall
		expect(config.systemPrompt).toContain("retrieval practice");

		// Should NOT have heavy skills
		expect(config.systemPrompt).not.toContain("memory palace");
		expect(config.systemPrompt).not.toContain("research-backed teaching");

		// Should use lighter model
		expect(config.modelId).toBe("google/gemini-2.5-flash-lite");
	});

	it("should cache skills across mode configurations", async () => {
		const promptService = createMockPromptService();
		const manager = createModeManager(promptService);
		const deps = createMockDependencies();

		// Load multiple modes
		await manager.getConfiguration("DEFAULT", deps);
		await manager.getConfiguration("EXAM", deps);
		await manager.getConfiguration("STUDY", deps);

		// Base skills should only be loaded once
		const calls = (promptService.getPrompt as ReturnType<typeof vi.fn>).mock
			.calls;
		const multiToolCalls = calls.filter((c) =>
			c[0].includes("multi-tool-calling"),
		);

		expect(multiToolCalls).toHaveLength(1);
	});
});
