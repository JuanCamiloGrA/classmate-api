import type { DevLogger } from "../logging/dev-logger";

/**
 * Scribe Manifest Service
 * Fetches template manifests from the SCRIBE_HEAVY_API to get configuration schemas
 */

/**
 * Template manifest returned by the Heavy API
 */
export interface TemplateManifest {
	/** JSON Schema for template_config fields */
	template_config_schema: Record<string, unknown>;
	/** Template metadata */
	template_id: string;
	template_name?: string;
	description?: string;
}

/**
 * Service for fetching template manifests from the Heavy API
 */
export class ScribeManifestService {
	constructor(
		private readonly apiUrl: string,
		private readonly apiKey: string,
		private readonly logger?: DevLogger,
	) {
		console.log("📋 [SCRIBE_MANIFEST] Initialized manifest service");
	}

	/**
	 * Fetches the manifest for a given template ID
	 * @param templateId - The template identifier (e.g., "apa", "ieee")
	 * @returns The template manifest containing the config schema
	 * @throws Error if the manifest cannot be fetched
	 */
	async getManifest(templateId: string): Promise<TemplateManifest> {
		console.log(
			`🔍 [SCRIBE_MANIFEST] Fetching manifest for template: ${templateId}`,
		);

		const url = `${this.apiUrl}/v1/templates/${templateId}/manifest`;
		this.logger?.logRequest("SCRIBE_MANIFEST", url, "GET", null, {
			"X-API-KEY": "***",
		});

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"X-API-KEY": this.apiKey,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			this.logger?.logResponse("SCRIBE_MANIFEST", url, response.status, {
				error: errorText,
			});
			console.error(`❌ [SCRIBE_MANIFEST] Failed to fetch manifest`, {
				status: response.status,
				templateId,
				error: errorText,
			});
			throw new Error(
				`Failed to fetch manifest for template "${templateId}": ${response.status} - ${errorText}`,
			);
		}

		const manifest = (await response.json()) as TemplateManifest;
		this.logger?.logResponse("SCRIBE_MANIFEST", url, response.status, manifest);
		console.log(`✅ [SCRIBE_MANIFEST] Manifest fetched successfully`, {
			templateId,
			hasSchema: !!manifest.template_config_schema,
		});

		return manifest;
	}
}
