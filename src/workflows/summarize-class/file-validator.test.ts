import { describe, expect, it } from "vitest";
import { FileValidator } from "./file-validator";

describe("FileValidator", () => {
	const validator = new FileValidator();

	describe("isAudioFile", () => {
		it("should return true for audio MIME types", () => {
			expect(validator.isAudioFile("audio/mpeg", "file.mp3")).toBe(true);
			expect(validator.isAudioFile("audio/wav", "file.wav")).toBe(true);
			expect(validator.isAudioFile("audio/ogg", "file.ogg")).toBe(true);
			expect(validator.isAudioFile("audio/flac", "file.flac")).toBe(true);
		});

		it("should return false for non-audio MIME types", () => {
			expect(validator.isAudioFile("text/plain", "file.txt")).toBe(false);
			expect(validator.isAudioFile("text/markdown", "file.md")).toBe(false);
			expect(validator.isAudioFile("application/pdf", "file.pdf")).toBe(false);
		});

		it("should detect audio from extension when MIME is octet-stream", () => {
			expect(
				validator.isAudioFile("application/octet-stream", "file.mp3"),
			).toBe(true);
			expect(
				validator.isAudioFile("application/octet-stream", "file.wav"),
			).toBe(true);
			expect(
				validator.isAudioFile("application/octet-stream", "file.txt"),
			).toBe(false);
		});

		it("should be case-insensitive for extensions", () => {
			expect(
				validator.isAudioFile("application/octet-stream", "file.MP3"),
			).toBe(true);
			expect(
				validator.isAudioFile("application/octet-stream", "file.WaV"),
			).toBe(true);
		});
	});

	describe("getAudioMimeType", () => {
		it("should return MIME type for audio files", () => {
			expect(validator.getAudioMimeType("audio/mpeg", "file.mp3")).toBe(
				"audio/mpeg",
			);
			expect(validator.getAudioMimeType("audio/wav", "file.wav")).toBe(
				"audio/wav",
			);
		});

		it("should return undefined for non-audio files", () => {
			expect(
				validator.getAudioMimeType("text/plain", "file.txt"),
			).toBeUndefined();
			expect(
				validator.getAudioMimeType("application/pdf", "file.pdf"),
			).toBeUndefined();
		});

		it("should detect and return MIME type from extension when octet-stream", () => {
			expect(
				validator.getAudioMimeType("application/octet-stream", "file.mp3"),
			).toBe("audio/mpeg");
			expect(
				validator.getAudioMimeType("application/octet-stream", "file.wav"),
			).toBe("audio/wav");
			expect(
				validator.getAudioMimeType("application/octet-stream", "file.m4a"),
			).toBe("audio/m4a");
		});

		it("should prefer provided MIME type over extension detection", () => {
			// If MIME type is already audio/*, use it
			expect(validator.getAudioMimeType("audio/mpeg", "file.wav")).toBe(
				"audio/mpeg",
			);
		});
	});
});
