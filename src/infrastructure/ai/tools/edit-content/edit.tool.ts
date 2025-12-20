import { tool } from "ai";
import { z } from "zod";
import { editContent } from "./edit-content";

export type EditToolState = {
	getContent: () => string;
	setContent: (next: string) => void;
};

export function createEditToolWithState(initialContent: string) {
	let current = initialContent;

	const state: EditToolState = {
		getContent: () => current,
		setContent: (next) => {
			current = next;
		},
	};

	const edit = tool({
		description: `Performs exact string replacements in content.

Rules:
- The edit FAILS if oldString is not found.
- The edit FAILS if oldString matches multiple times unless replaceAll=true.
- Provide multi-line oldString with surrounding context to make it unique.
- Preserve indentation and whitespace in oldString exactly.
- If oldString is empty, newString replaces the entire content.`,
		inputSchema: z.object({
			oldString: z
				.string()
				.describe("Text to replace (empty string to set entire content)"),
			newString: z.string().describe("Replacement text (must differ)"),
			replaceAll: z.boolean().optional().describe("Replace all occurrences"),
		}),
		execute: async ({ oldString, newString, replaceAll }) => {
			const result = editContent(current, oldString, newString, { replaceAll });
			if (!result.success) return result;
			current = result.content;
			return result;
		},
	});

	return { edit, state };
}
