import type { Bindings } from "../../config/bindings";
import { resolveSecretBinding } from "../../config/bindings";
import { VercelAIService } from "../../infrastructure/ai/vercel.ai.service";
import { DatabaseFactory } from "../../infrastructure/database/client";
import { D1SummaryRepository } from "../../infrastructure/database/repositories/summary.repository";
import { MiniGFMMarkdownService } from "../../infrastructure/markdown/minigfm.markdown.service";
import { CloudRunProcessingService } from "../../infrastructure/processing/cloud-run.processing.service";
import { AssetsPromptService } from "../../infrastructure/prompt/assets.prompt.service";
import { R2StorageAdapter } from "../../infrastructure/storage/r2.storage";
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
	const aiGatewayApiKey = await resolveSecretBinding(
		env.AI_GATEWAY_API_KEY,
		"AI_GATEWAY_API_KEY",
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
	const processingService = new CloudRunProcessingService(env);
	const aiService = new VercelAIService(aiGatewayApiKey);
	const promptService = new AssetsPromptService(env.ASSETS);
	const storageService = new R2StorageService({
		endpoint: r2Endpoint,
		accessKeyId: r2AccessKeyId,
		secretAccessKey: r2SecretAccessKey,
		bucketName: r2BucketName,
	});
	const markdownService = new MiniGFMMarkdownService();

	// Create storage adapter for generating presigned URLs
	const storageRepository = new R2StorageAdapter({
		endpoint: r2Endpoint,
		accessKeyId: r2AccessKeyId,
		secretAccessKey: r2SecretAccessKey,
	});

	// Create database connection and repository
	const db = DatabaseFactory.create(env.DB);
	const summaryRepository = new D1SummaryRepository(db);

	// Wire up and return handler
	return new SummarizeClassWorkflowHandler(
		processingService,
		aiService,
		storageService,
		storageRepository,
		summaryRepository,
		markdownService,
		promptService,
		r2BucketName,
	);
}
