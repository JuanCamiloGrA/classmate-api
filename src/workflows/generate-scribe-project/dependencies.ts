import { type Bindings, resolveSecretBinding } from "../../config/bindings";
import { ScribeAIService } from "../../infrastructure/ai/scribe.ai.service";
import { DatabaseFactory } from "../../infrastructure/database/client";
import { D1ScribeProjectRepository } from "../../infrastructure/database/repositories/d1-scribe-project.repository";
import { AssetsPromptService } from "../../infrastructure/prompt/assets.prompt.service";
import { GenerateScribeProjectWorkflowHandler } from "./handler";

export async function createGenerateScribeProjectWorkflowHandler(
	env: Bindings,
): Promise<GenerateScribeProjectWorkflowHandler> {
	const aiGatewayApiKey = await resolveSecretBinding(
		env.AI_GATEWAY_API_KEY,
		"AI_GATEWAY_API_KEY",
	);

	// Create prompt service for loading prompts from ASSETS
	const promptService = new AssetsPromptService(env.ASSETS);

	// Create Scribe-specific AI service with prompt support
	const scribeAIService = new ScribeAIService(aiGatewayApiKey, promptService);

	const db = DatabaseFactory.create(env.DB);
	const scribeProjectRepository = new D1ScribeProjectRepository(db);

	return new GenerateScribeProjectWorkflowHandler(
		scribeAIService,
		scribeProjectRepository,
	);
}
