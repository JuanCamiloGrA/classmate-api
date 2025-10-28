import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SummaryRepository } from "../../domain/repositories/summary.repository";
import type { AIService } from "../../domain/services/ai.service";
import type { MarkdownService } from "../../domain/services/markdown.service";
import type { PromptService } from "../../domain/services/prompt.service";
import type { StorageService } from "../../domain/services/storage.service";
import { SummarizeClassWorkflowHandler } from "./handler";
import type { WorkflowRequestBody } from "./types";

describe("SummarizeClassWorkflowHandler", () => {
	let handler: SummarizeClassWorkflowHandler;
	let mockAIService: AIService;
	let mockStorageService: StorageService;
	let mockSummaryRepository: SummaryRepository;
	let mockMarkdownService: MarkdownService;
	let mockPromptService: PromptService;
	let mockStep: WorkflowStep;

	beforeEach(() => {
		// Create mocks
		mockAIService = {
			generateContent: vi.fn(),
		};

		mockStorageService = {
			getFileBytes: vi.fn(),
			deleteFile: vi.fn(),
		};

		mockSummaryRepository = {
			save: vi.fn(),
		};

		mockMarkdownService = {
			parse: vi.fn(),
		};

		mockPromptService = {
			loadPrompt: vi.fn(),
		};

		// Create mock WorkflowStep
		mockStep = {
			do: vi.fn(async (_name, _config, fn) => {
				return await fn();
			}),
			sleep: vi.fn(),
			sleepUntil: vi.fn(),
		} as unknown as WorkflowStep;

		// Create handler instance
		handler = new SummarizeClassWorkflowHandler(
			mockAIService,
			mockStorageService,
			mockSummaryRepository,
			mockMarkdownService,
			mockPromptService,
		);
	});

	describe("run", () => {
		it("should process audio file successfully", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				file: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockFileBytes = new Uint8Array([1, 2, 3]);
			const mockPrompt = "Test prompt";
			const mockSummaryMarkdown = "# Test Summary\n\nContent here";
			const mockSummaryHtml = "<h1>Test Summary</h1><p>Content here</p>";

			(
				mockStorageService.getFileBytes as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockFileBytes);
			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockPrompt);
			(
				mockAIService.generateContent as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockSummaryMarkdown);
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				mockSummaryHtml,
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(mockStorageService.getFileBytes).toHaveBeenCalledWith(
				"temp/user-456/audio.mp3",
			);
			expect(mockPromptService.loadPrompt).toHaveBeenCalled();
			expect(mockAIService.generateContent).toHaveBeenCalledWith(
				mockPrompt,
				mockFileBytes,
				true, // isAudio
				"audio/mpeg",
			);
			expect(mockMarkdownService.parse).toHaveBeenCalledWith(
				mockSummaryMarkdown,
			);
			expect(mockSummaryRepository.save).toHaveBeenCalledWith(
				"class-123",
				"user-456",
				mockSummaryHtml,
			);
			expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
				"temp/user-456/audio.mp3",
			);
		});

		it("should process text file successfully", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				file: {
					r2Key: "temp/user-456/notes.txt",
					mimeType: "text/plain",
					filename: "notes.txt",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockFileBytes = new TextEncoder().encode("Text content");
			const mockPrompt = "Test prompt";
			const mockSummaryMarkdown = "# Summary";
			const mockSummaryHtml = "<h1>Summary</h1>";

			(
				mockStorageService.getFileBytes as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockFileBytes);
			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockPrompt);
			(
				mockAIService.generateContent as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockSummaryMarkdown);
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				mockSummaryHtml,
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(mockAIService.generateContent).toHaveBeenCalledWith(
				mockPrompt,
				"Text content",
				false, // isAudio
				undefined,
			);
		});

		it("should throw error when AI service returns empty response", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				file: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			(
				mockStorageService.getFileBytes as ReturnType<typeof vi.fn>
			).mockResolvedValue(new Uint8Array([1, 2, 3]));
			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue("Test prompt");
			(
				mockAIService.generateContent as ReturnType<typeof vi.fn>
			).mockResolvedValue(""); // Empty response

			// Act & Assert
			await expect(handler.run(mockEvent, mockStep)).rejects.toThrow(
				"AI service returned empty response",
			);
		});

		it("should execute all three workflow steps", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				file: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			(
				mockStorageService.getFileBytes as ReturnType<typeof vi.fn>
			).mockResolvedValue(new Uint8Array([1, 2, 3]));
			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue("Test prompt");
			(
				mockAIService.generateContent as ReturnType<typeof vi.fn>
			).mockResolvedValue("# Summary\n\nTest");
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				"<h1>Summary</h1>",
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(mockStep.do).toHaveBeenCalledTimes(3);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				1,
				"generate-summary",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				2,
				"save-summary",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				3,
				"cleanup-temp-file",
				expect.any(Object),
				expect.any(Function),
			);
		});
	});
});
