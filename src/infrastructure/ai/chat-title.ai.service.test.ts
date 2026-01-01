/**
 * Tests for AI Chat Title Generator
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIChatTitleGenerator } from "./chat-title.ai.service";

// Store the mock function reference
const mockGenerateText = vi.fn();

// Mock the AI SDK
vi.mock("ai", () => ({
	createGateway: vi.fn(() => vi.fn(() => ({}))),
	generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

describe("AIChatTitleGenerator", () => {
	const mockApiKey = "test-api-key";

	beforeEach(() => {
		mockGenerateText.mockReset();
	});

	describe("generateAsync", () => {
		it("should return 'New Chat' for empty content", async () => {
			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync("");
			expect(result).toBe("New Chat");
		});

		it("should return 'New Chat' for whitespace-only content", async () => {
			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync("   \n\t  ");
			expect(result).toBe("New Chat");
		});

		it("should generate title from AI response", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "Homework Help",
			});

			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync(
				"Can you help me with my math homework?",
			);
			expect(result).toBe("Homework Help");
		});

		it("should strip quotes from AI response", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: '"Homework Help"',
			});

			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync(
				"Can you help me with my math homework?",
			);
			expect(result).toBe("Homework Help");
		});

		it("should truncate long titles", async () => {
			const longTitle =
				"This is a very long title that exceeds the maximum allowed length of fifty characters";
			mockGenerateText.mockResolvedValueOnce({
				text: longTitle,
			});

			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync("Some message");
			expect(result.length).toBeLessThanOrEqual(50);
			expect(result).toContain("...");
		});

		it("should fall back to simple generator on AI error", async () => {
			mockGenerateText.mockRejectedValueOnce(new Error("API Error"));

			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync(
				"Can you help me with my math homework?",
			);
			// Simple generator truncates the first sentence or first 50 chars
			expect(result).toBeTruthy();
			expect(result.length).toBeLessThanOrEqual(53); // 50 + "..."
		});

		it("should fall back if AI returns empty text", async () => {
			mockGenerateText.mockResolvedValueOnce({
				text: "",
			});

			const generator = new AIChatTitleGenerator(mockApiKey);
			const result = await generator.generateAsync("Hello world");
			expect(result).toBeTruthy();
		});
	});
});
