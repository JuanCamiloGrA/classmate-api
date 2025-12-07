import { type Bindings, resolveSecretBinding } from "../../config/bindings";
import { ScribeAIService } from "../../infrastructure/ai/scribe.ai.service";
import { ScribeManifestService } from "../../infrastructure/api/scribe-manifest.service";
import { DatabaseFactory } from "../../infrastructure/database/client";
import { D1ScribeProjectRepository } from "../../infrastructure/database/repositories/d1-scribe-project.repository";
import { D1ProfileRepository } from "../../infrastructure/database/repositories/profile.repository";
import { D1SubjectRepository } from "../../infrastructure/database/repositories/subject.repository";
import { ScribePdfService } from "../../infrastructure/pdf/scribe-pdf.service";
import { AssetsPromptService } from "../../infrastructure/prompt/assets.prompt.service";
import { R2StorageAdapter } from "../../infrastructure/storage/r2.storage";
import { GenerateScribeProjectWorkflowHandler } from "./handler";

export async function createGenerateScribeProjectWorkflowHandler(
	env: Bindings,
): Promise<GenerateScribeProjectWorkflowHandler> {
	const aiGatewayApiKey = await resolveSecretBinding(
		env.AI_GATEWAY_API_KEY,
		"AI_GATEWAY_API_KEY",
	);

	// Resolve secrets for PDF service
	const scribeHeavyApiUrl = await resolveSecretBinding(
		env.SCRIBE_HEAVY_API_URL,
		"SCRIBE_HEAVY_API_URL",
	);
	const internalScribeApiKey = await resolveSecretBinding(
		env.INTERNAL_SCRIBE_API_KEY,
		"INTERNAL_SCRIBE_API_KEY",
	);

	// Resolve secrets for R2 persistent storage (for presigned URLs)
	const r2Endpoint = await resolveSecretBinding(
		env.R2_S3_PERSISTENT_API_ENDPOINT,
		"R2_S3_PERSISTENT_API_ENDPOINT",
	);
	const r2AccessKeyId = await resolveSecretBinding(
		env.R2_PERSISTENT_ACCESS_KEY_ID,
		"R2_PERSISTENT_ACCESS_KEY_ID",
	);
	const r2SecretAccessKey = await resolveSecretBinding(
		env.R2_PERSISTENT_SECRET_ACCESS_KEY,
		"R2_PERSISTENT_SECRET_ACCESS_KEY",
	);
	const r2BucketName = await resolveSecretBinding(
		env.R2_PERSISTENT_BUCKET_NAME,
		"R2_PERSISTENT_BUCKET_NAME",
	);

	// Create prompt service for loading prompts from ASSETS
	const promptService = new AssetsPromptService(env.ASSETS);

	// Create Scribe-specific AI service with prompt support
	const scribeAIService = new ScribeAIService(aiGatewayApiKey, promptService);

	// Create PDF generation service
	const pdfService = new ScribePdfService(
		scribeHeavyApiUrl,
		internalScribeApiKey,
	);

	// Create manifest service for fetching template schemas
	const manifestService = new ScribeManifestService(
		scribeHeavyApiUrl,
		internalScribeApiKey,
	);

	// Create storage adapter for presigned URLs
	const storageAdapter = new R2StorageAdapter({
		endpoint: r2Endpoint,
		accessKeyId: r2AccessKeyId,
		secretAccessKey: r2SecretAccessKey,
	});

	const db = DatabaseFactory.create(env.DB);
	const scribeProjectRepository = new D1ScribeProjectRepository(db);
	const profileRepository = new D1ProfileRepository(db);
	const subjectRepository = new D1SubjectRepository(db);

	return new GenerateScribeProjectWorkflowHandler(
		scribeAIService,
		scribeProjectRepository,
		profileRepository,
		subjectRepository,
		pdfService,
		manifestService,
		storageAdapter,
		r2BucketName,
		env.ENVIRONMENT,
	);
}
