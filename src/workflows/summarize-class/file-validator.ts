/**
 * File Validator Service
 * Provides utilities for file type detection and validation
 */

const MIME_TYPE_MAP: Record<string, string> = {
	// Audio formats
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	flac: "audio/flac",
	m4a: "audio/m4a",
	aac: "audio/aac",
	wma: "audio/wma",
	mka: "audio/matroska",
	// Text formats
	txt: "text/plain",
	md: "text/markdown",
	markdown: "text/markdown",
};

export class FileValidator {
	isAudioFile(mimeType: string, filename: string): boolean {
		const detectedMimeType =
			mimeType === "application/octet-stream"
				? this.getMimeTypeFromExtension(filename)
				: mimeType;
		return (
			mimeType.startsWith("audio/") || detectedMimeType.startsWith("audio/")
		);
	}

	getAudioMimeType(mimeType: string, filename: string): string | undefined {
		const isAudioFile = this.isAudioFile(mimeType, filename);
		const detectedMimeType =
			mimeType === "application/octet-stream"
				? this.getMimeTypeFromExtension(filename)
				: mimeType;

		if (isAudioFile) {
			return mimeType.startsWith("audio/") ? mimeType : detectedMimeType;
		}
		return undefined;
	}

	private getMimeTypeFromExtension(filename: string): string {
		const ext = filename.toLowerCase().split(".").pop();
		return MIME_TYPE_MAP[ext || ""] || "application/octet-stream";
	}
}
