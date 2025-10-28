/**
 * Markdown Service Interface (Port)
 * Defines contract for markdown to HTML conversion
 */
export interface MarkdownService {
	parse(markdown: string): string;
}
