import type {
	LibraryItem,
	LibraryItemStatus,
	LibraryItemType,
	StorageUsage,
} from "../../domain/entities/library";

/**
 * Format bytes to human-readable string (e.g., "1.2 KB", "45 MB").
 */
export function formatBytes(bytes: number, decimals = 1): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	const value = bytes / k ** i;
	return `${Number.parseFloat(value.toFixed(dm))} ${sizes[i]}`;
}

/**
 * Map mime type to library item type.
 */
export function mimeTypeToLibraryType(
	mimeType: string,
	docType?: string | null,
): LibraryItemType {
	if (docType) {
		const normalized = docType.toLowerCase();
		if (
			["audio", "pdf", "image", "summary", "scribe_doc"].includes(normalized)
		) {
			return normalized as LibraryItemType;
		}
	}

	if (mimeType === "application/pdf") return "pdf";
	if (mimeType.startsWith("audio/")) return "audio";
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType === "text/plain" || mimeType === "text/markdown") {
		return "summary";
	}

	return "other";
}

/**
 * Response DTO for a single library item.
 */
export interface LibraryItemDTO {
	id: string;
	source: "user_file" | "scribe_project";
	title: string;
	type: LibraryItemType;
	subject: string | null;
	subjectColor: string | null;
	date: string;
	size: string;
	status: LibraryItemStatus;
	linkedTaskId: string | null;
	linkedTaskTitle: string | null;
	downloadUrl: string | null;
}

/**
 * Response DTO for library list endpoint.
 */
export interface LibraryListResponseDTO {
	success: true;
	meta: {
		total: number;
		limit: number;
		offset: number;
	};
	result: LibraryItemDTO[];
}

/**
 * Response DTO for storage usage endpoint.
 */
export interface StorageUsageDTO {
	usedBytes: number;
	totalBytes: number;
	usedFormatted: string;
	totalFormatted: string;
	percentage: number;
	tier: "free" | "pro" | "premium";
}

/**
 * Response DTO for presigned upload URL.
 */
export interface PresignedUploadDTO {
	uploadUrl: string;
	fileId: string;
	r2Key: string;
}

/**
 * Convert domain LibraryItem to DTO.
 */
export function toLibraryItemDTO(
	item: LibraryItem,
	downloadUrl: string | null = null,
): LibraryItemDTO {
	return {
		id: item.id,
		source: item.source,
		title: item.title,
		type: item.type,
		subject: item.subjectName,
		subjectColor: item.subjectColor,
		date: item.date,
		size: item.sizeBytes ? formatBytes(item.sizeBytes) : "0 Bytes",
		status: item.status,
		linkedTaskId: item.linkedTaskId,
		linkedTaskTitle: item.linkedTaskTitle,
		downloadUrl,
	};
}

/**
 * Convert storage usage to DTO.
 */
export function toStorageUsageDTO(usage: StorageUsage): StorageUsageDTO {
	const percentage =
		usage.totalBytes > 0
			? Math.round((usage.usedBytes / usage.totalBytes) * 100)
			: 0;

	return {
		usedBytes: usage.usedBytes,
		totalBytes: usage.totalBytes,
		usedFormatted: formatBytes(usage.usedBytes),
		totalFormatted: formatBytes(usage.totalBytes),
		percentage,
		tier: usage.tier,
	};
}
