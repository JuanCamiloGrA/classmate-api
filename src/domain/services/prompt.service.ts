/**
 * Prompt Service Interface (Port)
 * Defines contract for loading prompt templates
 */
export interface PromptService {
	loadPrompt(): Promise<string>;
	getPrompt(path: string): Promise<string>;
}
