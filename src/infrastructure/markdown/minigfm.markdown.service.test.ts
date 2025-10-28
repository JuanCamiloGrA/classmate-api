import { describe, expect, it } from "vitest";
import { MiniGFMMarkdownService } from "./minigfm.markdown.service";

describe("MiniGFMMarkdownService", () => {
	const service = new MiniGFMMarkdownService();

	describe("parse", () => {
		it("should convert markdown to HTML", () => {
			// Arrange
			const markdown = "# Hello World\n\nThis is a test.";

			// Act
			const result = service.parse(markdown);

			// Assert
			expect(result).toContain("<h1");
			expect(result).toContain("Hello World");
			expect(result).toContain("<p");
			expect(result).toContain("This is a test.");
		});

		it("should handle markdown lists", () => {
			// Arrange
			const markdown = "- Item 1\n- Item 2\n- Item 3";

			// Act
			const result = service.parse(markdown);

			// Assert
			expect(result).toContain("<li");
			expect(result).toContain("Item 1");
			expect(result).toContain("Item 2");
			expect(result).toContain("Item 3");
		});

		it("should code blocks", () => {
			// Arrange
			const markdown = "```javascript\nconst x = 42;\n```";

			// Act
			const result = service.parse(markdown);

			// Assert
			expect(result).toContain("const x = 42");
		});

		it("should handle bold and italic text", () => {
			// Arrange
			const markdown = "**bold** and *italic* text";

			// Act
			const result = service.parse(markdown);

			// Assert
			expect(result).toContain("<strong");
			expect(result).toContain("bold");
			expect(result).toContain("<em");
			expect(result).toContain("italic");
		});

		it("should sanitize unsafe content (XSS protection)", () => {
			// Arrange
			const markdown = "<script>alert('xss')</script>";

			// Act
			const result = service.parse(markdown);

			// Assert
			// MiniGFM with unsafe: false should sanitize this
			expect(result).not.toContain("<script>");
		});

		it("should handle empty markdown", () => {
			// Arrange
			const markdown = "";

			// Act
			const result = service.parse(markdown);

			// Assert
			// MiniGFM may wrap empty content in paragraph tags
			expect(result).toBeDefined();
		});

		it("should handle complex markdown structure", () => {
			// Arrange
			const markdown = `# Main Title

## Subtitle

This is a paragraph with **bold** and *italic* text.

- List item 1
- List item 2

### Subsection

\`inline code\` example.`;

			// Act
			const result = service.parse(markdown);

			// Assert
			expect(result).toContain("<h1");
			expect(result).toContain("<h2");
			expect(result).toContain("<h3");
			expect(result).toContain("<li");
			expect(result).toContain("<strong");
			expect(result).toContain("<em");
			expect(result).toContain("<code");
		});
	});
});
