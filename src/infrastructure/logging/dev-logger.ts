export class DevLogger {
	constructor(private readonly environment: string) {}

	private isDevelopment(): boolean {
		return this.environment === "development";
	}

	log(tag: string, message: string, data?: unknown) {
		if (!this.isDevelopment()) return;

		const timestamp = new Date().toISOString();

		// We use console.log because Cloudflare Workers don't have a local file system.
		// The user can pipe the output of 'wrangler dev' to a file if needed.
		console.log(`[${timestamp}] [${tag}] ${message}`);
		if (data) {
			console.log(`--- DETAIL [${tag}] ---`);
			console.log(JSON.stringify(data, null, 2));
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
		this.log(tag, `Request: ${method} ${url}`, { body, headers });
	}

	logResponse(tag: string, url: string, status: number, body?: unknown) {
		this.log(tag, `Response: ${status} ${url}`, { body });
	}
}
