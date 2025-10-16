import type { Next } from "hono";
import type { AppContext } from "../../../types";

export async function requestIdMiddleware(c: AppContext, next: Next) {
	const requestId = c.req.header("X-Request-ID") || crypto.randomUUID();
	c.set("requestId", requestId);

	c.header("X-Request-ID", requestId);

	await next();
}
