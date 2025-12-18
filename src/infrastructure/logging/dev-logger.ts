export class DevLogger {
	constructor(private readonly environment: string) {}

	private isDevelopment(): boolean {
		return this.environment === "development";
	}

	private encodeUtf8(str: string): string {
		// Ensure the string is properly encoded as UTF-8
		// This is particularly important for characters with diacritics (tildes, accents, etc.)
		return new TextDecoder().decode(new TextEncoder().encode(str));
	}

	log(tag: string, message: string, data?: unknown) {
		if (!this.isDevelopment()) return;

		const timestamp = new Date().toISOString();

		// We use console.log because Cloudflare Workers don't have a local file system.
		// The user can pipe the output of 'wrangler dev' to a file if needed.
		// Ensure UTF-8 encoding for proper display of accents and special characters
		const encodedMessage = this.encodeUtf8(message);
		const encodedTag = this.encodeUtf8(tag);
		console.log(`[${timestamp}] [${encodedTag}] ${encodedMessage}`);
		if (data) {
			console.log(`--- DETAIL [${encodedTag}] ---`);
			// JSON.stringify handles UTF-8 correctly, but we ensure the output is valid
			try {
				const jsonStr = JSON.stringify(data, null, 2);
				const encodedJson = this.encodeUtf8(jsonStr);
				console.log(encodedJson);
			} catch (error) {
				console.log(
					`[Error serializing data]: ${this.encodeUtf8(String(error))}`,
				);
			}
			console.log(`-----------------------`);
		}
	}

	logRequest(
		tag: string,
		url: string,
		method: string,
		body?: unknown,
		headers?: Record<string, string>,
	) {
		const encodedTag = this.encodeUtf8(tag);
		const encodedUrl = this.encodeUtf8(url);
		const encodedMethod = this.encodeUtf8(method);
		this.log(encodedTag, `Request: ${encodedMethod} ${encodedUrl}`, {
			body,
			headers,
		});
	}

	logResponse(tag: string, url: string, status: number, body?: unknown) {
		const encodedTag = this.encodeUtf8(tag);
		const encodedUrl = this.encodeUtf8(url);
		this.log(encodedTag, `Response: ${status} ${encodedUrl}`, { body });
	}
}
