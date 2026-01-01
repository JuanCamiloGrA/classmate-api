/**
 * Tool Executions Unit Tests
 * Tests for HITL tool execution functions
 */
import { describe, expect, it, vi } from "vitest";
import { executions, hitlToolNames } from "./executions";

describe("Tool Executions", () => {
	describe("hitlToolNames", () => {
		it("should include removeClass", () => {
			expect(hitlToolNames).toContain("removeClass");
		});
	});

	describe("removeClass execution", () => {
		const mockContext = {
			messages: [],
			toolCallId: "test-call-id",
		} as any;

		it("should execute successfully with classId", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await executions.removeClass(
				{
					classId: "class-123",
				},
				mockContext,
			);

			expect(result).toEqual({
				success: true,
				message: "Class class-123 has been permanently deleted.",
				deletedId: "class-123",
			});
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("removeClass approved"),
			);

			consoleSpy.mockRestore();
		});

		it("should execute successfully with classId and reason", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await executions.removeClass(
				{
					classId: "class-456",
					reason: "No longer needed",
				},
				mockContext,
			);

			expect(result).toEqual({
				success: true,
				message: "Class class-456 has been permanently deleted.",
				deletedId: "class-456",
			});

			consoleSpy.mockRestore();
		});
	});
});
