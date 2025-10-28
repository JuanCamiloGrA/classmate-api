import { describe, expect, it } from "vitest";
import { ProcessAudioSchema } from "../validators/class.validator";

describe("ProcessClassAudioEndpoint", () => {
	describe("ProcessAudioSchema Validation", () => {
		it("should validate correct audio processing request", () => {
			// Arrange
			const validData = {
				r2_key: "temp/user123/audio.mp3",
				file_name: "audio.mp3",
				mime_type: "audio/mpeg",
			};

			// Act
			const result = ProcessAudioSchema.safeParse(validData);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.r2_key).toBe("temp/user123/audio.mp3");
				expect(result.data.file_name).toBe("audio.mp3");
				expect(result.data.mime_type).toBe("audio/mpeg");
			}
		});

		it("should reject request with missing r2_key", () => {
			// Arrange
			const invalidData = {
				file_name: "audio.mp3",
				mime_type: "audio/mpeg",
			};

			// Act
			const result = ProcessAudioSchema.safeParse(invalidData);

			// Assert
			expect(result.success).toBe(false);
		});

		it("should reject request with empty r2_key", () => {
			// Arrange
			const invalidData = {
				r2_key: "",
				file_name: "audio.mp3",
				mime_type: "audio/mpeg",
			};

			// Act
			const result = ProcessAudioSchema.safeParse(invalidData);

			// Assert
			expect(result.success).toBe(false);
		});

		it("should reject request with missing file_name", () => {
			// Arrange
			const invalidData = {
				r2_key: "temp/user123/audio.mp3",
				mime_type: "audio/mpeg",
			};

			// Act
			const result = ProcessAudioSchema.safeParse(invalidData);

			// Assert
			expect(result.success).toBe(false);
		});

		it("should reject request with missing mime_type", () => {
			// Arrange
			const invalidData = {
				r2_key: "temp/user123/audio.mp3",
				file_name: "audio.mp3",
			};

			// Act
			const result = ProcessAudioSchema.safeParse(invalidData);

			// Assert
			expect(result.success).toBe(false);
		});

		it("should accept various audio MIME types", () => {
			// Arrange
			const mimeTypes = [
				"audio/mpeg",
				"audio/wav",
				"audio/ogg",
				"audio/flac",
				"audio/m4a",
				"text/plain",
			];

			// Act & Assert
			for (const mimeType of mimeTypes) {
				const data = {
					r2_key: "temp/user123/file",
					file_name: "file",
					mime_type: mimeType,
				};
				const result = ProcessAudioSchema.safeParse(data);
				expect(result.success).toBe(true);
			}
		});
	});
});
