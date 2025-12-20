export type EditContentResult =
	| { success: true; content: string }
	| { success: false; content: string; error: string };

export function normalizeLineEndings(text: string): string {
	return text.replaceAll("\r\n", "\n");
}

type ReplaceOptions = { replaceAll?: boolean };

function replaceOnce(
	content: string,
	oldString: string,
	newString: string,
): string {
	const first = content.indexOf(oldString);
	if (first === -1) throw new Error("oldString not found in content");
	const last = content.lastIndexOf(oldString);
	if (first !== last) {
		throw new Error(
			"Found multiple matches for oldString. Provide more surrounding lines in oldString to identify the correct match.",
		);
	}
	return (
		content.slice(0, first) +
		newString +
		content.slice(first + oldString.length)
	);
}

function replaceAll(
	content: string,
	oldString: string,
	newString: string,
): string {
	if (!content.includes(oldString))
		throw new Error("oldString not found in content");
	return content.replaceAll(oldString, newString);
}

/**
 * Edit a string by replacing `oldString` with `newString`.
 * - Normalizes line endings to LF.
 * - If oldString is "", sets the entire content to newString.
 */
export function editContent(
	content: string,
	oldString: string,
	newString: string,
	options: ReplaceOptions = {},
): EditContentResult {
	try {
		const normalizedContent = normalizeLineEndings(content);
		const normalizedOld = normalizeLineEndings(oldString);
		const normalizedNew = normalizeLineEndings(newString);

		if (normalizedOld === normalizedNew) {
			return {
				success: false,
				content: normalizedContent,
				error: "oldString and newString must be different",
			};
		}

		if (normalizedOld === "") {
			return { success: true, content: normalizedNew };
		}

		const next = options.replaceAll
			? replaceAll(normalizedContent, normalizedOld, normalizedNew)
			: replaceOnce(normalizedContent, normalizedOld, normalizedNew);

		return { success: true, content: next };
	} catch (e) {
		return {
			success: false,
			content: normalizeLineEndings(content),
			error: e instanceof Error ? e.message : String(e),
		};
	}
}
