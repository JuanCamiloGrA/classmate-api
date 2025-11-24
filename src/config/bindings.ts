import type { D1Database, Workflow } from "@cloudflare/workers-types";
import type { Database } from "../infrastructure/database/client";

type SecretsStoreBinding =
	| string
	| {
			get(): Promise<string>;
	  };

export type Bindings = {
	DB: D1Database;
	ENVIRONMENT: "development" | "staging" | "production";
	CLERK_WEBHOOK_SECRET: string;
	CLERK_SECRET_KEY: SecretsStoreBinding;
	CLERK_PUBLISHABLE_KEY: SecretsStoreBinding;
	ALLOWED_ORIGIN: SecretsStoreBinding;
	R2_S3_API_ENDPOINT: SecretsStoreBinding;
	R2_ACCESS_KEY_ID: SecretsStoreBinding;
	R2_SECRET_ACCESS_KEY: SecretsStoreBinding;
	R2_TEMPORAL_BUCKET_NAME: SecretsStoreBinding;
	R2_PRESIGNED_URL_EXPIRATION_SECONDS?: string;
	AI_GATEWAY_API_KEY: SecretsStoreBinding;
	PROCESSING_SERVICE_URL: SecretsStoreBinding;
	INTERNAL_API_KEY: SecretsStoreBinding;
	SUMMARIZE_CLASS_WORKFLOW: Workflow;
	GENERATE_SCRIBE_PROJECT_WORKFLOW: Workflow;
	ASSETS: Fetcher;
};

export type Variables = {
	userId?: string;
	db?: Database;
	requestId?: string;
};

export type { SecretsStoreBinding };

export async function resolveSecretBinding(
	binding: SecretsStoreBinding | undefined,
	bindingName: string,
): Promise<string> {
	if (typeof binding === "string") {
		const value = binding.trim();
		if (!value) {
			throw new Error(`${bindingName} secret is empty`);
		}
		return value;
	}
	if (binding && typeof binding.get === "function") {
		try {
			const value = (await binding.get()).trim();
			if (!value) {
				throw new Error(`${bindingName} secret is empty`);
			}
			return value;
		} catch (error) {
			if (
				error instanceof Error &&
				/Secret "[^"]+" not found/.test(error.message)
			) {
				throw new Error(
					`${bindingName} secret is missing. Run "npx wrangler secret put ${bindingName} --local" for local development, and ensure it is configured in your Cloudflare Secrets Store for remote environments.`,
				);
			}
			throw error;
		}
	}
	throw new Error(`${bindingName} binding missing`);
}
