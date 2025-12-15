export type R2Category =
	| "scribe_exports"
	| "class_audio"
	| "rubrics"
	| "user_uploads"
	| "avatars"
	| "temp";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

export function getUtcYearMonth(now = new Date()): {
	year: string;
	month: string;
} {
	return {
		year: String(now.getUTCFullYear()),
		month: pad2(now.getUTCMonth() + 1),
	};
}

export function sanitizeFilename(original: string): string {
	const trimmed = original.trim();
	if (!trimmed) return "file";
	return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildUserR2Key(params: {
	userId: string;
	category: R2Category;
	now?: Date;
	uuid?: string;
	filename: string;
}): string {
	const { year, month } = getUtcYearMonth(params.now);
	const uuid = params.uuid ?? crypto.randomUUID();
	const safeName = sanitizeFilename(params.filename);
	return `users/${params.userId}/${params.category}/${year}/${month}/${uuid}-${safeName}`;
}
