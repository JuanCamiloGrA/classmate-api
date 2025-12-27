/**
 * Chat WebSocket Route
 * Handles WebSocket connections for ClassmateAgent
 *
 * Route: /agents/classmate-agent/:conversationId
 * Protocol: WebSocket (via Cloudflare Agents SDK)
 */

import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import type { Bindings, Variables } from "../../../config/bindings";
import { getAuth } from "../../../infrastructure/auth";

type HonoContext = { Bindings: Bindings; Variables: Variables };

/**
 * Create the chat routes for ClassmateAgent
 * Must be mounted at the root level to handle /agents/* paths
 */
export function createChatRoutes() {
	const app = new Hono<HonoContext>();

	/**
	 * WebSocket upgrade handler for ClassmateAgent
	 *
	 * The Agents SDK expects routes in the format:
	 * /agents/{agent-name}/{agent-id}
	 *
	 * Auth is checked here before upgrade, then userId is passed
	 * to the agent via query params
	 */
	app.all("/agents/classmate-agent/:conversationId", async (c) => {
		// Check authentication via Clerk
		const auth = getAuth(c);

		if (!auth?.userId) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const userId = auth.userId;
		const orgId = auth.orgId || undefined;

		// Clone the request and add userId/orgId to URL params
		// The agent will read these in onConnect
		const url = new URL(c.req.url);
		url.searchParams.set("userId", userId);
		if (orgId) {
			url.searchParams.set("orgId", orgId);
		}

		// Create a new request with the modified URL
		const modifiedRequest = new Request(url.toString(), {
			method: c.req.raw.method,
			headers: c.req.raw.headers,
			body: c.req.raw.body,
		});

		// Route to the agent - this handles WebSocket upgrade internally
		const response = await routeAgentRequest(modifiedRequest, c.env);

		if (response) {
			return response;
		}

		// If routeAgentRequest returns null, the route didn't match
		return c.json({ error: "Agent not found" }, 404);
	});

	return app;
}

/**
 * Direct handler for use in main worker fetch
 * Can be used when not going through Hono middleware
 */
export async function handleAgentRequest(
	request: Request,
	env: Bindings,
	userId: string,
	orgId?: string,
): Promise<Response | null> {
	// Add auth info to the request URL
	const url = new URL(request.url);
	url.searchParams.set("userId", userId);
	if (orgId) {
		url.searchParams.set("orgId", orgId);
	}

	const modifiedRequest = new Request(url.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
	});

	return routeAgentRequest(modifiedRequest, env);
}
