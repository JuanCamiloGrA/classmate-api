import type { KVNamespace } from "@cloudflare/workers-types";
import type { Next } from "hono";
import type { AppContext } from "../../../types";

/**
 * Configuration options for the rate limiter
 */
export type RateLimiterConfig = {
	/**
	 * Maximum number of requests allowed within the time window
	 * @default 10
	 */
	maxRequests?: number;
	/**
	 * Time window in minutes
	 * @default 5
	 */
	windowMinutes?: number;
};

/**
 * Creates a rate limiter middleware for Cloudflare Workers
 *
 * Uses KV storage with sliding window rate limiting based on client IP address.
 * Returns 429 Too Many Requests if the limit is exceeded.
 *
 * Note: Cloudflare Workers has built-in DDoS protection and rate limiting through
 * Cloudflare's infrastructure. This middleware provides an additional application-level
 * rate limiter for specific endpoints that need custom limits.
 *
 * @param kvNamespace - Cloudflare KV namespace for storing rate limit counters
 * @param config - Configuration options for rate limiting
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { createRateLimiter } from './middleware/rate-limiter';
 *
 * const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV, {
 *   maxRequests: 5,
 *   windowMinutes: 1,
 * });
 *
 * app.post('/feedback', rateLimiter, CreateFeedbackEndpoint);
 * ```
 */
export function createRateLimiter(
	kvNamespace: KVNamespace,
	config?: RateLimiterConfig,
) {
	const maxRequests = config?.maxRequests ?? 10;
	const windowMinutes = config?.windowMinutes ?? 5;
	const windowSeconds = windowMinutes * 60;

	return async (c: AppContext, next: Next) => {
		try {
			// Get client IP from CF-Connecting-IP header (standard in Cloudflare Workers)
			// Fall back to other common headers if not available
			const clientIp =
				c.req.header("CF-Connecting-IP") ||
				c.req.header("X-Forwarded-For")?.split(",")[0] ||
				c.req.header("X-Client-IP") ||
				"unknown";

			// Normalize IP (remove whitespace)
			const normalizedIp = clientIp.trim();

			// Create a key based on IP and current minute window
			const now = Math.floor(Date.now() / 1000);
			const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
			const rateLimitKey = `ratelimit:${normalizedIp}:${windowStart}`;

			// Get current count from KV
			const countStr = await kvNamespace.get(rateLimitKey);
			const count = countStr ? parseInt(countStr, 10) : 0;

			// Calculate time until window reset
			const windowEnd = windowStart + windowSeconds;

			// Add rate limit headers to response
			c.header("X-RateLimit-Limit", String(maxRequests));
			c.header(
				"X-RateLimit-Remaining",
				String(Math.max(0, maxRequests - count)),
			);
			c.header("X-RateLimit-Reset", String(windowEnd));

			// Check if limit exceeded
			if (count >= maxRequests) {
				return c.json(
					{
						error: "Too Many Requests",
						message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMinutes} minute(s).`,
					},
					429,
				);
			}

			// Increment counter in KV with expiration
			const newCount = count + 1;
			await kvNamespace.put(rateLimitKey, String(newCount), {
				expirationTtl: windowSeconds,
			});

			// Update remaining header with new count
			c.header(
				"X-RateLimit-Remaining",
				String(Math.max(0, maxRequests - newCount)),
			);

			await next();
		} catch (error) {
			// If rate limiter fails, log the error and continue
			// We don't want to block requests due to rate limiter errors
			console.error("[RateLimiter] Error:", error);
			await next();
		}
	};
}
