import type { Context, Next } from "hono";
import type { Bindings } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";

const DEFAULT_ALLOWED_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"OPTIONS",
];

const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization"];

const DEFAULT_MAX_AGE_SECONDS = 600;

type CorsOptions = {
	allowCredentials?: boolean;
	allowedHeaders?: string[];
	allowedMethods?: string[];
	exposeHeaders?: string[];
	maxAgeSeconds?: number;
};

/**
 * Handles CORS negotiation using ALLOWED_ORIGIN secret(s).
 * Supports comma-separated origins and gracefully rejects disallowed origins.
 */
export function corsMiddleware(options?: CorsOptions) {
	const {
		allowCredentials = true,
		allowedHeaders = DEFAULT_ALLOWED_HEADERS,
		allowedMethods = DEFAULT_ALLOWED_METHODS,
		exposeHeaders = [],
		maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
	} = options ?? {};

	return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
		const origin = c.req.header("Origin");
		const method = c.req.method;

		if (!origin) {
			if (method === "OPTIONS") {
				return c.body(null, 204);
			}
			await next();
			return;
		}

		const allowedOriginSecret = await resolveSecretBinding(
			c.env.ALLOWED_ORIGIN,
			"ALLOWED_ORIGIN",
		);

		const allowedOrigins = allowedOriginSecret
			.split(",")
			.map((value) => value.trim())
			.filter(Boolean);

		const matchedOrigin = findMatchingOrigin(origin, allowedOrigins);

		if (!matchedOrigin) {
			if (method === "OPTIONS") {
				return c.json({ error: "CORS origin not allowed" }, 403);
			}
			await next();
			return;
		}

		mergeVaryHeader(c, "Origin");

		const allowOriginValue =
			matchedOrigin === "*" ? (allowCredentials ? origin : "*") : matchedOrigin;

		c.header("Access-Control-Allow-Origin", allowOriginValue);

		if (allowCredentials) {
			c.header("Access-Control-Allow-Credentials", "true");
		}

		if (exposeHeaders.length > 0) {
			c.header("Access-Control-Expose-Headers", exposeHeaders.join(", "));
		}

		c.header("Access-Control-Allow-Methods", allowedMethods.join(", "));

		const requestHeaders = c.req.header("Access-Control-Request-Headers");
		if (requestHeaders) {
			c.header("Access-Control-Allow-Headers", requestHeaders);
		} else if (allowedHeaders.length > 0) {
			c.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
		}

		if (maxAgeSeconds > 0) {
			c.header("Access-Control-Max-Age", String(maxAgeSeconds));
		}

		if (method === "OPTIONS") {
			return c.body(null, 204);
		}

		await next();
	};
}

function findMatchingOrigin(
	origin: string,
	allowedOrigins: string[],
): string | undefined {
	for (const allowed of allowedOrigins) {
		if (allowed === "*") {
			return allowed;
		}
		if (origin === allowed) {
			return allowed;
		}
	}
	return undefined;
}

function mergeVaryHeader(c: Context, value: string) {
	const existing = c.res.headers.get("Vary");
	if (!existing) {
		c.header("Vary", value);
		return;
	}

	const varyValues = existing
		.split(",")
		.map((header) => header.trim())
		.filter(Boolean);

	if (!varyValues.includes(value)) {
		varyValues.push(value);
		c.header("Vary", varyValues.join(", "));
	}
}
