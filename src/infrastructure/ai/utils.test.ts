/**
 * AI Utils Unit Tests
 * Tests for processToolCalls and cleanupMessages
 */

import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { APPROVAL } from "./shared";
import { cleanupMessages } from "./utils";

describe("AI Utils", () => {
	describe("cleanupMessages", () => {
		it("should keep messages without tool calls", () => {
			const messages: UIMessage[] = [
				{
					id: "1",
					role: "user",
					parts: [{ type: "text", text: "Hello" }],
				},
				{
					id: "2",
					role: "assistant",
					parts: [{ type: "text", text: "Hi there!" }],
				},
			];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(2);
		});

		it("should filter out messages with incomplete tool calls (input-streaming)", () => {
			const messages: UIMessage[] = [
				{
					id: "1",
					role: "user",
					parts: [{ type: "text", text: "Delete my class" }],
				},
				{
					id: "2",
					role: "assistant",
					parts: [
						{
							type: "tool-removeClass",
							toolCallId: "tc-1",
							state: "input-streaming",
							input: { classId: "class-123" },
						} as unknown as UIMessage["parts"][number],
					],
				},
			];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("1");
		});

		it("should filter out messages with input-available but no output", () => {
			const messages: UIMessage[] = [
				{
					id: "1",
					role: "user",
					parts: [{ type: "text", text: "Delete my class" }],
				},
				{
					id: "2",
					role: "assistant",
					parts: [
						{
							type: "tool-removeClass",
							toolCallId: "tc-1",
							state: "input-available",
							input: { classId: "class-123" },
							// No output = waiting for user approval
						} as unknown as UIMessage["parts"][number],
					],
				},
			];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(1);
		});

		it("should keep messages with completed tool calls (output-available)", () => {
			const messages: UIMessage[] = [
				{
					id: "1",
					role: "user",
					parts: [{ type: "text", text: "Delete my class" }],
				},
				{
					id: "2",
					role: "assistant",
					parts: [
						{
							type: "tool-removeClass",
							toolCallId: "tc-1",
							state: "output-available",
							input: { classId: "class-123" },
							output: APPROVAL.YES,
						} as unknown as UIMessage["parts"][number],
					],
				},
			];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(2);
		});

		it("should keep messages with error text even without output", () => {
			const messages: UIMessage[] = [
				{
					id: "1",
					role: "assistant",
					parts: [
						{
							type: "tool-removeClass",
							toolCallId: "tc-1",
							state: "input-available",
							input: { classId: "class-123" },
							errorText: "Tool execution failed",
						} as unknown as UIMessage["parts"][number],
					],
				},
			];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(1);
		});

		it("should handle messages without parts", () => {
			const messages = [
				{ id: "1", role: "user" },
				{ id: "2", role: "assistant" },
			] as UIMessage[];

			const result = cleanupMessages(messages);
			expect(result).toHaveLength(2);
		});
	});

	describe("APPROVAL constants", () => {
		it("should have correct approval values", () => {
			expect(APPROVAL.YES).toBe("Yes, confirmed.");
			expect(APPROVAL.NO).toBe("No, denied.");
		});
	});
});
