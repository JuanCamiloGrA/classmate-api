import type { Bindings } from "../../config/bindings";
import { resolveSecretBinding } from "../../config/bindings";
import { GoogleAIService } from "../../infrastructure/ai/google.ai.service";
import { DatabaseFactory } from "../../infrastructure/database/client";
import { D1SummaryRepository } from "../../infrastructure/database/repositories/summary.repository";
import { MiniGFMMarkdownService } from "../../infrastructure/markdown/minigfm.markdown.service";
import { AssetsPromptService } from "../../infrastructure/prompt/assets.prompt.service";
import { R2StorageService } from "../../infrastructure/storage/r2.storage.service";
import { SummarizeClassWorkflowHandler } from "./handler";

/**
 * Dependency Injection Factory
 * Creates and wires up all services and repositories for the workflow
 */
export async function createSummarizeClassWorkflowHandler(
	env: Bindings,
): Promise<SummarizeClassWorkflowHandler> {
	// Resolve secrets
	const geminiApiKey = await resolveSecretBinding(
		env.GEMINI_API_KEY,
		"GEMINI_API_KEY",
	);
	const r2Endpoint = await resolveSecretBinding(
		env.R2_S3_API_ENDPOINT,
		"R2_S3_API_ENDPOINT",
	);
	const r2AccessKeyId = await resolveSecretBinding(
		env.R2_ACCESS_KEY_ID,
		"R2_ACCESS_KEY_ID",
	);
	const r2SecretAccessKey = await resolveSecretBinding(
		env.R2_SECRET_ACCESS_KEY,
		"R2_SECRET_ACCESS_KEY",
	);
	const r2BucketName = await resolveSecretBinding(
		env.R2_TEMPORAL_BUCKET_NAME,
		"R2_TEMPORAL_BUCKET_NAME",
	);

	// Create infrastructure services
	const aiService = new GoogleAIService(geminiApiKey);
	const promptService = new AssetsPromptService(env.ASSETS);
	const storageService = new R2StorageService({
		endpoint: r2Endpoint,
		accessKeyId: r2AccessKeyId,
		secretAccessKey: r2SecretAccessKey,
		bucketName: r2BucketName,
	});
	const markdownService = new MiniGFMMarkdownService();

	// Create database connection and repository
	const db = DatabaseFactory.create(env.DB);
	const summaryRepository = new D1SummaryRepository(db);

	// Wire up and return handler
	return new SummarizeClassWorkflowHandler(
		aiService,
		storageService,
		summaryRepository,
		markdownService,
		promptService,
	);
}
