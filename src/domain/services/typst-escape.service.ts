/**
 * Typst Escape Normalization Service
 *
 * Fixes corrupted LaTeX/Typst escape sequences in AI-generated content.
 * When AI models output JSON with unescaped backslashes, the JSON parser
 * interprets sequences like \t as tab, \n as newline, etc.
 *
 * This service detects and repairs these corrupted patterns:
 *   - \times → tab + "imes" → fixed back to \times
 *   - \frac  → formfeed + "rac" → fixed back to \frac
 *   - \nabla → newline + "abla" → fixed back to \nabla
 *   - etc.
 */

/** Control characters mapped to their escape letter prefix */
const CONTROL_CHARS: Array<[string, string]> = [
	["\t", "t"], // tab
	["\n", "n"], // newline
	["\r", "r"], // carriage return
	["\f", "f"], // form feed
	["\b", "b"], // backspace
];

/** Common LaTeX/Typst command suffixes by prefix letter */
const COMMAND_SUFFIXES: Record<string, string[]> = {
	t: [
		"imes",
		"heta",
		"au",
		"ext",
		"extbf",
		"extit",
		"extrm",
		"o",
		"op",
		"an",
		"anh",
		"riangle",
		"herefore",
		"ilde",
	],
	n: ["abla", "eq", "e", "u", "eg", "ot", "i", "otin", "less", "gtr", "orm"],
	r: ["ho", "ightarrow", "ef", "m", "angle", "ceil", "floor", "oot"],
	f: ["rac", "orall", "lat", "ootnote"],
	b: ["eta", "ar", "f", "inom", "ot", "ecause", "igcap", "igcup", "mod"],
};

/**
 * Normalizes corrupted escape sequences in Typst/LaTeX content.
 *
 * @param content - The content string from AI output
 * @returns The content with proper backslash escapes restored
 */
export function normalizeTypstEscapes(content: string): string {
	if (!content) return content;

	let result = content;

	for (const [controlChar, prefix] of CONTROL_CHARS) {
		const suffixes = COMMAND_SUFFIXES[prefix];
		if (!suffixes) continue;

		// Sort by length descending to match longest first (e.g., "ightarrow" before "ho")
		const sortedSuffixes = [...suffixes].sort((a, b) => b.length - a.length);

		for (const suffix of sortedSuffixes) {
			// Replace control char + suffix with backslash + prefix + suffix
			const corrupted = controlChar + suffix;
			const fixed = `\\${prefix}${suffix}`;
			result = result.split(corrupted).join(fixed);
		}
	}

	return result;
}

/** Replace common LaTeX operator commands with safe Unicode equivalents */
export function replaceLatexOperatorsWithUnicode(content: string): string {
	if (!content) return content;

	const replacements: Array<[RegExp, string]> = [
		[/\\times/g, "×"],
		[/\\cdot/g, "·"],
		[/\\pm/g, "±"],
		[/\\leq/g, "≤"],
		[/\\geq/g, "≥"],
		[/\\neq/g, "≠"],
	];

	return replacements.reduce(
		(acc, [pattern, value]) => acc.replace(pattern, value),
		content,
	);
}

/** Full normalization: fix corrupted escapes, then make operators Unicode-safe */
export function normalizeTypstContent(content: string): string {
	const fixedEscapes = normalizeTypstEscapes(content);
	return replaceLatexOperatorsWithUnicode(fixedEscapes);
}
