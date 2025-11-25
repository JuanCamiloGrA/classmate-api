import {
	createGateway,
	generateObject,
	generateText,
	type ModelMessage,
} from "ai";
import type { z } from "zod";
import type { PromptService } from "../../domain/services/prompt.service";
import type { ScribeAgentConfig } from "../../domain/services/scribe/agents";

/**
 * Scribe AI Service
 *
 * Specialized AI service for Scribe workflow that supports:
 * - System prompts loaded from ASSETS
 * - File attachments (PDF, images, text)
 * - Structured output with Zod schemas (generateObject)
 * - Text generation (generateText)
 */
export class ScribeAIService {
	private gateway: ReturnType<typeof createGateway>;

	constructor(
		apiKey: string,
		private promptService: PromptService,
	) {
		this.gateway = createGateway({ apiKey });
	}

	/**
	 * Build a user message with optional file and text content
	 */
	private buildUserMessage(options: {
		fileUrl?: string;
		fileMimeType?: string;
		textContent?: string;
		userMessage?: string;
	}): ModelMessage {
		const content: Array<
			| { type: "text"; text: string }
			| { type: "file"; data: URL; mediaType: string }
		> = [];

		// Add file if provided (URL-based for Gemini)
		if (options.fileUrl && options.fileMimeType) {
			content.push({
				type: "file",
				data: new URL(options.fileUrl),
				mediaType: options.fileMimeType,
			});
		}

		// Add text content if provided
		if (options.textContent) {
			content.push({
				type: "text",
				text: options.textContent,
			});
		}

		// Add user message if provided
		if (options.userMessage) {
			content.push({
				type: "text",
				text: options.userMessage,
			});
		}

		// If no content parts, add a default message
		if (content.length === 0) {
			content.push({
				type: "text",
				text: "Please analyze and generate the output.",
			});
		}

		return {
			role: "user",
			content,
		};
	}

	/**
	 * Run an agent with structured output (using generateObject)
	 *
	 * @param agent - Agent configuration with model, promptPath, and outputSchema
	 * @param options - Options for the agent run
	 * @returns Parsed and validated output matching the schema
	 */
	async runAgentWithSchema<T extends z.ZodType>(
		agent: ScribeAgentConfig & { outputSchema: T },
		options: {
			/** Optional file URL to attach (PDF, image, etc.) */
			fileUrl?: string;
			/** MIME type of the file */
			fileMimeType?: string;
			/** Optional text content (fallback if no file) */
			textContent?: string;
			/** Additional context to append to the user message */
			userMessage?: string;
		},
	): Promise<z.infer<T>> {
		const model = this.gateway(agent.model);
		const systemPrompt = await this.promptService.getPrompt(agent.promptPath);
		const userMessage = this.buildUserMessage(options);

		const { object } = await generateObject({
			model,
			schema: agent.outputSchema,
			output: "object",
			system: systemPrompt,
			messages: [userMessage],
		});

		return object;
	}

	/**
	 * Run an agent with text output (using generateText)
	 *
	 * @param agent - Agent configuration with model and promptPath
	 * @param options - Options for the agent run
	 * @returns Generated text content
	 */
	async runAgentWithText(
		agent: ScribeAgentConfig,
		options: {
			/** Optional file URL to attach (PDF, image, etc.) */
			fileUrl?: string;
			/** MIME type of the file */
			fileMimeType?: string;
			/** Optional text content */
			textContent?: string;
			/** Template variables to replace in the prompt (e.g., {{RUBRIC}}) */
			templateVars?: Record<string, string>;
		},
	): Promise<string> {
		const model = this.gateway(agent.model);
		let systemPrompt = await this.promptService.getPrompt(agent.promptPath);

		// Replace template variables in system prompt
		if (options.templateVars) {
			for (const [key, value] of Object.entries(options.templateVars)) {
				systemPrompt = systemPrompt.replace(
					new RegExp(`\\{\\{${key}\\}\\}`, "g"),
					value,
				);
			}
		}

		const userMessage = this.buildUserMessage({
			fileUrl: options.fileUrl,
			fileMimeType: options.fileMimeType,
			textContent: options.textContent,
		});

		const { text } = await generateText({
			model,
			system: systemPrompt,
			messages: [userMessage],
		});

		return text;
	}
}
