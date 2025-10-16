import { Hono } from "hono";
import type { Bindings, Variables } from "../config/bindings";
import { resolveSecretBinding } from "../config/bindings";
import { clerkMiddleware, getAuth } from "../infrastructure/auth";
import { DatabaseFactory } from "../infrastructure/database/client";
import { handleError } from "./http/middleware/error-handler";
import { requestIdMiddleware } from "./http/middleware/request-id";

type Dependencies = Record<string, unknown>;
type HonoContext = { Bindings: Bindings; Variables: Variables };

export function createApp(_dependencies?: Dependencies) {
	const app = new Hono<HonoContext>();

	// ============================================
	// MIDDLEWARE - Order matters!
	// ============================================

	// 1. Request ID (observabilidad)
	app.use("*", requestIdMiddleware);

	// 2. Database initialization (instantiate per-request using env binding)
	app.use("*", async (c, next) => {
		// Ensure the DB binding exists and pass the D1Database binding to the factory
		if (!c.env.DB) throw new Error("DB binding missing");
		const dbInstance = DatabaseFactory.create(c.env.DB);
		c.set("db", dbInstance as Database);
		await next();
	});

	// 3. CORS middleware
	app.use("*", async (c, next) => {
		const origin = c.req.header("Origin");
		const allowedOrigin = await resolveSecretBinding(
			c.env.ALLOWED_ORIGIN,
			"ALLOWED_ORIGIN",
		);

		if (origin === allowedOrigin) {
			c.header("Access-Control-Allow-Origin", origin);
			c.header("Access-Control-Allow-Credentials", "true");
			c.header(
				"Access-Control-Allow-Methods",
				"GET, POST, PUT, DELETE, OPTIONS",
			);
			c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
		}

		if (c.req.method === "OPTIONS") {
			return new Response(null, { status: 204 });
		}

		await next();
	});

	// 4. Clerk authentication
	app.use("*", clerkMiddleware());

	// ============================================
	// ROUTES
	// ============================================

	// Health check endpoint
	app.get("/health", (c) => c.json({ status: "ok" }));

	// Example protected route
	app.get("/me", (c) => {
		const auth = getAuth(c);
		if (!auth?.userId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		return c.json({ userId: auth.userId });
	});

	// Note: Profile routes are registered in index.ts (src/index.ts) via Chanfana's fromHono
	// This allows them to be documented in the OpenAPI schema

	// Add routes here:
	// app.route('/api/terms', createTermRoutes(_dependencies));

	// ============================================
	// ERROR HANDLER - Must be last!
	// ============================================
	app.onError((err, c) => {
		return handleError(err, c);
	});

	return app;
}

type Database = ReturnType<typeof DatabaseFactory.create>;
