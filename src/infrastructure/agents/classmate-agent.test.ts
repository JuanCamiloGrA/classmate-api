/**
 * ClassmateAgent Unit Tests
 * Tests for the agent's core functionality
 */
import { describe, expect, it } from "vitest";
import { APPROVAL } from "../ai/shared";
import { executions, hitlToolNames } from "../ai/tools/executions";
import { cleanupMessages } from "../ai/utils";

describe("ClassmateAgent HITL Flow", () => {
	describe("cleanupMessages", () => {
		it("should filter out messages with incomplete tool calls (input-streaming)", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-removeClass",
							state: "input-streaming",
							toolCallId: "call-1",
							input: { classId: "123" },
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			// The message with incomplete tool call should be removed
			expect(cleaned).toHaveLength(1);
			expect(cleaned[0].role).toBe("user");
		});

		it("should filter out messages with input-available but no output", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-removeClass",
							state: "input-available",
							toolCallId: "call-1",
							input: { classId: "123" },
							// No output or errorText - incomplete
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(1);
			expect(cleaned[0].role).toBe("user");
		});

		it("should keep messages with completed tool results (output-available)", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "",
					parts: [
						{
							type: "tool-removeClass",
							state: "output-available",
							toolCallId: "call-1",
							input: { classId: "123" },
							output: { success: true },
						},
					],
				},
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(2);
		});

		it("should keep messages without parts", () => {
			const messages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			] as any;

			const cleaned = cleanupMessages(messages);

			expect(cleaned).toHaveLength(2);
		});
	});

	describe("Tool Executions Registry", () => {
		it("should have removeClass registered", () => {
			expect(hitlToolNames).toContain("removeClass");
		});

		it("should execute removeClass successfully", async () => {
			const mockContext = {
				messages: [],
				toolCallId: "test-call-id",
			} as any;

			const result = await executions.removeClass(
				{
					classId: "test-id",
					reason: "Testing",
				},
				mockContext,
			);

			expect(result).toHaveProperty("success", true);
			expect(result).toHaveProperty("deletedId", "test-id");
		});
	});

	describe("APPROVAL constants", () => {
		it("should have YES and NO values", () => {
			expect(APPROVAL.YES).toBe("Yes, confirmed.");
			expect(APPROVAL.NO).toBe("No, denied.");
		});
	});
});
