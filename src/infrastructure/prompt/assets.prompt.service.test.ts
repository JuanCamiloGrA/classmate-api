import { describe, expect, it, vi } from "vitest";
import { AssetsPromptService } from "./assets.prompt.service";

describe("AssetsPromptService", () => {
	describe("loadPrompt", () => {
		it("should load prompt from ASSETS successfully", async () => {
			// Arrange
			const mockPromptContent = "This is a test prompt from assets";
			const mockResponse = new Response(mockPromptContent, { status: 200 });
			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			const mockAssets = { fetch: mockFetch } as unknown as Fetcher;

			const service = new AssetsPromptService(mockAssets);

			// Act
			const result = await service.loadPrompt();

			// Assert
			expect(result).toBe(mockPromptContent);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "http://assets/prompt.txt",
				}),
			);
		});

		it("should return default prompt when ASSETS binding is not available", async () => {
			// Arrange
			const service = new AssetsPromptService(undefined);

			// Act
			const result = await service.loadPrompt();

			// Assert
			expect(result).toContain(
				"You are an assistant that reads a class transcript",
			);
		});

		it("should return default prompt when fetch fails", async () => {
			// Arrange
			const mockResponse = new Response(null, { status: 404 });
			const mockFetch = vi.fn().mockResolvedValue(mockResponse);
			const mockAssets = { fetch: mockFetch } as unknown as Fetcher;

			const service = new AssetsPromptService(mockAssets);

			// Act
			const result = await service.loadPrompt();

			// Assert
			expect(result).toContain(
				"You are an assistant that reads a class transcript",
			);
		});

		it("should return default prompt when fetch throws error", async () => {
			// Arrange
			const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
			const mockAssets = { fetch: mockFetch } as unknown as Fetcher;

			const service = new AssetsPromptService(mockAssets);

			// Act
			const result = await service.loadPrompt();

			// Assert
			expect(result).toContain(
				"You are an assistant that reads a class transcript",
			);
		});
	});
});
