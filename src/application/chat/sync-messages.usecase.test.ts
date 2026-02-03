/**
 * Tests for SyncMessagesUseCase
 * Verifies message syncing and AI title generation flow.
 */

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { Chat, MessageSyncBatch } from "../../domain/entities/chat";
import type { ChatRepository } from "../../domain/repositories/chat.repository";
import type { AsyncChatTitleGenerator } from "../../domain/services/chat-title.service";
import { DEFAULT_CHAT_TITLE } from "../../domain/services/chat-title.service";
import { SyncMessagesUseCase } from "./sync-messages.usecase";

// ============================================
// MOCK FACTORIES
// ============================================

function createMockChatRepository(): ChatRepository & {
	[K in keyof ChatRepository]: Mock;
} {
	return {
		create: vi.fn(),
		findById: vi.fn().mockResolvedValue(null),
		findByIdWithMessages: vi.fn(),
		findAllByUserId: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		restore: vi.fn(),
		hardDelete: vi.fn().mockResolvedValue(true),
		getMessages: vi.fn(),
		getMessageAttachments: vi.fn(),
		getLastSequence: vi.fn(),
		syncMessages: vi.fn().mockResolvedValue(2),
		exists: vi.fn(),
		countByUserId: vi.fn(),
	};
}

function createMockTitleGenerator(): AsyncChatTitleGenerator & {
	generateAsync: Mock;
} {
	return {
		generateAsync: vi.fn().mockResolvedValue("Generated Title"),
	};
}

function createMockChat(overrides: Partial<Chat> = {}): Chat {
	return {
		id: "chat-123",
		userId: "user-456",
		title: null,
		lastMessageAt: null,
		messageCount: 0,
		isPinned: false,
		isArchived: false,
		model: null,
		temperature: null,
		contextType: null,
		contextId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

function createMockBatch(
	overrides: Partial<MessageSyncBatch> = {},
): MessageSyncBatch {
	return {
		chatId: "chat-123",
		userId: "user-456",
		lastSyncedSequence: 0,
		messages: [
			{
				chatId: "chat-123",
				userId: "user-456",
				role: "user",
				sequence: 1,
				content: "Hello, can you help me with math?",
				status: null,
				latencyMs: null,
				inputTokens: null,
				outputTokens: null,
				errorMessage: null,
				toolCalls: null,
			},
			{
				chatId: "chat-123",
				userId: "user-456",
				role: "assistant",
				sequence: 2,
				content: "Of course! What math topic do you need help with?",
				status: null,
				latencyMs: null,
				inputTokens: null,
				outputTokens: null,
				errorMessage: null,
				toolCalls: null,
			},
		],
		...overrides,
	};
}

// ============================================
// TESTS
// ============================================

describe("SyncMessagesUseCase", () => {
	let chatRepository: ReturnType<typeof createMockChatRepository>;
	let titleGenerator: ReturnType<typeof createMockTitleGenerator>;

	beforeEach(() => {
		vi.clearAllMocks();
		chatRepository = createMockChatRepository();
		titleGenerator = createMockTitleGenerator();
	});

	describe("execute", () => {
		it("should sync messages to repository", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			// Chat exists but has no title
			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: null }),
			);

			const result = await useCase.execute({ batch });

			expect(chatRepository.syncMessages).toHaveBeenCalledWith(batch);
			expect(result.synced).toBe(2);
			expect(result.chatId).toBe("chat-123");
		});

		it("should generate title when chat has no title", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			// Chat exists but has no title
			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: null }),
			);

			const result = await useCase.execute({ batch });

			expect(titleGenerator.generateAsync).toHaveBeenCalledWith(
				"Hello, can you help me with math?",
			);
			expect(chatRepository.update).toHaveBeenCalledWith(
				"user-456",
				"chat-123",
				{ title: "Generated Title" },
			);
			expect(result.generatedTitle).toBe("Generated Title");
		});

		it("should generate title when chat title is 'New Chat'", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			// Chat has "New Chat" as title
			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: DEFAULT_CHAT_TITLE }),
			);

			const result = await useCase.execute({ batch });

			expect(titleGenerator.generateAsync).toHaveBeenCalled();
			expect(result.generatedTitle).toBe("Generated Title");
		});

		it("should NOT generate title when chat already has a real title", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			// Chat already has a real title
			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: "Math Homework Help" }),
			);

			const result = await useCase.execute({ batch });

			expect(titleGenerator.generateAsync).not.toHaveBeenCalled();
			expect(chatRepository.update).not.toHaveBeenCalled();
			expect(result.generatedTitle).toBeUndefined();
		});

		it("should NOT generate title when no messages were synced", async () => {
			chatRepository.syncMessages.mockResolvedValue(0);
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			const result = await useCase.execute({ batch });

			expect(titleGenerator.generateAsync).not.toHaveBeenCalled();
			expect(result.synced).toBe(0);
		});

		it("should NOT generate title when no title generator is provided", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository); // No title generator
			const batch = createMockBatch();

			const result = await useCase.execute({ batch });

			expect(result.generatedTitle).toBeUndefined();
		});

		it("should use first USER message for title generation", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch({
				messages: [
					{
						chatId: "chat-123",
						userId: "user-456",
						role: "system",
						sequence: 1,
						content: "You are a helpful assistant",
						status: null,
						latencyMs: null,
						inputTokens: null,
						outputTokens: null,
						errorMessage: null,
						toolCalls: null,
					},
					{
						chatId: "chat-123",
						userId: "user-456",
						role: "user",
						sequence: 2,
						content: "Tell me about physics",
						status: null,
						latencyMs: null,
						inputTokens: null,
						outputTokens: null,
						errorMessage: null,
						toolCalls: null,
					},
				],
			});

			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: null }),
			);

			await useCase.execute({ batch });

			// Should use the user message, not the system message
			expect(titleGenerator.generateAsync).toHaveBeenCalledWith(
				"Tell me about physics",
			);
		});

		it("should NOT generate title when batch has no user messages", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch({
				messages: [
					{
						chatId: "chat-123",
						userId: "user-456",
						role: "assistant",
						sequence: 1,
						content: "Hello! How can I help?",
						status: null,
						latencyMs: null,
						inputTokens: null,
						outputTokens: null,
						errorMessage: null,
						toolCalls: null,
					},
				],
			});

			chatRepository.findById.mockResolvedValue(
				createMockChat({ title: null }),
			);

			const result = await useCase.execute({ batch });

			expect(titleGenerator.generateAsync).not.toHaveBeenCalled();
			expect(result.generatedTitle).toBeUndefined();
		});

		it("should handle findById returning null (chat not found after auto-provision)", async () => {
			const useCase = new SyncMessagesUseCase(chatRepository, titleGenerator);
			const batch = createMockBatch();

			// Chat not found - this could happen in edge cases
			chatRepository.findById.mockResolvedValue(null);

			const result = await useCase.execute({ batch });

			// When the chat cannot be loaded, we should not attempt to generate a title,
			// because we cannot safely update a non-existent chat record.
			expect(titleGenerator.generateAsync).not.toHaveBeenCalled();
			expect(result.generatedTitle).toBeUndefined();
		});
	});
});
