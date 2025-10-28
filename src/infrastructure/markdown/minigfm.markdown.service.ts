import { MiniGFM } from "@oblivionocean/minigfm";
import type { MarkdownService } from "../../domain/services/markdown.service";

/**
 * MiniGFM Markdown Service
 * Implements MarkdownService using MiniGFM (XSS-safe)
 */
export class MiniGFMMarkdownService implements MarkdownService {
	private md: MiniGFM;

	constructor() {
		// Initialize with XSS-safe settings
		this.md = new MiniGFM({ unsafe: false });
	}

	parse(markdown: string): string {
		return this.md.parse(markdown);
	}
}
