import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageRepository } from "../../domain/repositories/storage.repository";
import type { SummaryRepository } from "../../domain/repositories/summary.repository";
import type { AIService } from "../../domain/services/ai.service";
import type { MarkdownService } from "../../domain/services/markdown.service";
import type { ProcessingService } from "../../domain/services/processing.service";
import type { PromptService } from "../../domain/services/prompt.service";
import type { StorageService } from "../../domain/services/storage.service";
import { SummarizeClassWorkflowHandler } from "./handler";
import type { WorkflowRequestBody } from "./types";

describe("SummarizeClassWorkflowHandler", () => {
	let handler: SummarizeClassWorkflowHandler;
	let mockProcessingService: ProcessingService;
	let mockAIService: AIService;
	let mockStorageService: StorageService;
	let mockStorageRepository: StorageRepository;
	let mockSummaryRepository: SummaryRepository;
	let mockMarkdownService: MarkdownService;
	let mockPromptService: PromptService;
	let mockStep: WorkflowStep;

	beforeEach(() => {
		// Create mocks
		mockProcessingService = {
			processUrl: vi.fn(),
		};

		mockAIService = {
			generateContent: vi.fn(),
			generateSummaryFromUrl: vi.fn(),
		};

		mockStorageService = {
			getFileBytes: vi.fn(),
			deleteFile: vi.fn(),
		};

		mockStorageRepository = {
			generatePresignedPutUrl: vi.fn(),
			generatePresignedGetUrl: vi.fn(),
			headObject: vi.fn(),
		};

		mockSummaryRepository = {
			save: vi.fn(),
			updateAIStatus: vi.fn(),
		};

		mockMarkdownService = {
			parse: vi.fn(),
		};

		mockPromptService = {
			loadPrompt: vi.fn(),
			getPrompt: vi.fn(),
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
			mockProcessingService,
			mockAIService,
			mockStorageService,
			mockStorageRepository,
			mockSummaryRepository,
			mockMarkdownService,
			mockPromptService,
			"temporal-bucket",
		);
	});

	describe("run", () => {
		it("should process audio file successfully", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				input: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockPrompt = "Test prompt";
			const mockFileUrl =
				"https://bucket.r2.example.com/temp/user-456/audio.mp3?signed";
			const mockSummaryMarkdown = "# Test Summary\n\nContent here";
			const mockSummaryHtml = "<h1>Test Summary</h1><p>Content here</p>";

			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockPrompt);
			(
				mockStorageRepository.generatePresignedGetUrl as ReturnType<
					typeof vi.fn
				>
			).mockResolvedValue(mockFileUrl);
			(
				mockAIService.generateSummaryFromUrl as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockSummaryMarkdown);
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				mockSummaryHtml,
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(
				mockStorageRepository.generatePresignedGetUrl,
			).toHaveBeenCalledWith("temporal-bucket", "temp/user-456/audio.mp3", 300);
			expect(mockPromptService.loadPrompt).toHaveBeenCalled();
			expect(mockAIService.generateSummaryFromUrl).toHaveBeenCalledWith(
				mockPrompt,
				mockFileUrl,
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
			expect(mockSummaryRepository.updateAIStatus).toHaveBeenCalledWith(
				"class-123",
				"user-456",
				"processing",
			);
			expect(mockSummaryRepository.updateAIStatus).toHaveBeenCalledWith(
				"class-123",
				"user-456",
				"done",
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
				input: {
					r2Key: "temp/user-456/notes.txt",
					mimeType: "text/plain",
					filename: "notes.txt",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockPrompt = "Test prompt";
			const mockFileUrl =
				"https://bucket.r2.example.com/temp/user-456/notes.txt?signed";
			const mockSummaryMarkdown = "# Summary";
			const mockSummaryHtml = "<h1>Summary</h1>";

			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockPrompt);
			(
				mockStorageRepository.generatePresignedGetUrl as ReturnType<
					typeof vi.fn
				>
			).mockResolvedValue(mockFileUrl);
			(
				mockAIService.generateSummaryFromUrl as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockSummaryMarkdown);
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				mockSummaryHtml,
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(mockAIService.generateSummaryFromUrl).toHaveBeenCalledWith(
				mockPrompt,
				mockFileUrl,
				"text/plain",
			);
		});

		it("should throw error when AI service returns empty response", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				input: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockPrompt = "Test prompt";
			const mockFileUrl =
				"https://bucket.r2.example.com/temp/user-456/audio.mp3?signed";

			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue(mockPrompt);
			(
				mockStorageRepository.generatePresignedGetUrl as ReturnType<
					typeof vi.fn
				>
			).mockResolvedValue(mockFileUrl);
			(
				mockAIService.generateSummaryFromUrl as ReturnType<typeof vi.fn>
			).mockResolvedValue(""); // Empty response

			// Act & Assert
			await expect(handler.run(mockEvent, mockStep)).rejects.toThrow(
				"AI service returned empty response",
			);
		});

		it("should execute all four workflow steps", async () => {
			// Arrange
			const mockPayload: WorkflowRequestBody = {
				classId: "class-123",
				userId: "user-456",
				input: {
					r2Key: "temp/user-456/audio.mp3",
					mimeType: "audio/mpeg",
					filename: "audio.mp3",
				},
			};

			const mockEvent = {
				payload: mockPayload,
				timestamp: new Date(),
			} as WorkflowEvent<WorkflowRequestBody>;

			const mockFileUrl =
				"https://bucket.r2.example.com/temp/user-456/audio.mp3?signed";

			(
				mockPromptService.loadPrompt as ReturnType<typeof vi.fn>
			).mockResolvedValue("Test prompt");
			(
				mockStorageRepository.generatePresignedGetUrl as ReturnType<
					typeof vi.fn
				>
			).mockResolvedValue(mockFileUrl);
			(
				mockAIService.generateSummaryFromUrl as ReturnType<typeof vi.fn>
			).mockResolvedValue("# Summary\n\nTest");
			(mockMarkdownService.parse as ReturnType<typeof vi.fn>).mockReturnValue(
				"<h1>Summary</h1>",
			);

			// Act
			await handler.run(mockEvent, mockStep);

			// Assert
			expect(mockStep.do).toHaveBeenCalledTimes(6);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				1,
				"ai-status-processing",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				2,
				"prepare-file-input",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				3,
				"generate-summary",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				4,
				"save-summary",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				5,
				"cleanup-temp-file",
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockStep.do).toHaveBeenNthCalledWith(
				6,
				"ai-status-done",
				expect.any(Object),
				expect.any(Function),
			);
		});
	});
});
