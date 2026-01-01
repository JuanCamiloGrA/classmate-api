/**
 * Chat Route Utilities
 * Handles authentication for ClassmateAgent requests
 *
 * Route: /agents/classmate-agent/:conversationId
 * Protocol: HTTP POST / WebSocket (via Cloudflare Agents SDK)
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import type { Bindings } from "../../../config/bindings";
import { resolveSecretBinding } from "../../../config/bindings";

/**
 * Verify Clerk authentication from request headers or query parameters
 * Used before routing to the agent
 *
 * For WebSocket connections with cross-origin auth, the token may be passed
 * as a query parameter (_clerk_session_token) instead of in cookies/headers.
 */
export async function verifyClerkAuth(
	request: Request,
	env: Bindings,
): Promise<{ userId: string; orgId?: string } | null> {
	try {
		// Get Clerk keys
		const secretKey = await resolveSecretBinding(
			env.CLERK_SECRET_KEY,
			"CLERK_SECRET_KEY",
		);
		const publishableKey = await resolveSecretBinding(
			env.CLERK_PUBLISHABLE_KEY,
			"CLERK_PUBLISHABLE_KEY",
		);

		// Check for token in query parameters (used for WebSocket connections)
		const url = new URL(request.url);
		const queryToken = url.searchParams.get("_clerk_session_token");

		if (queryToken) {
			// Verify the JWT token directly for WebSocket/cross-origin requests
			try {
				const session = await verifyToken(queryToken, {
					secretKey,
				});

				return {
					userId: session.sub,
					orgId: session.org_id ?? undefined,
				};
			} catch (tokenError) {
				console.error(
					"[Chat Auth] Failed to verify token from query params:",
					tokenError,
				);
				return null;
			}
		}

		// Fall back to standard cookie/header-based auth for regular requests
		const clerk = createClerkClient({
			secretKey,
			publishableKey,
		});

		// Verify the request
		const authResult = await clerk.authenticateRequest(request);

		if (!authResult.isSignedIn) {
			return null;
		}

		return {
			userId: authResult.toAuth().userId,
			orgId: authResult.toAuth().orgId ?? undefined,
		};
	} catch (error) {
		console.error("[Chat Auth] Failed to verify Clerk auth:", error);
		return null;
	}
}

/**
 * Add user info to request URL for agent consumption
 */
export function addUserInfoToRequest(
	request: Request,
	userId: string,
	orgId?: string,
): Request {
	const url = new URL(request.url);
	url.searchParams.set("userId", userId);
	if (orgId) {
		url.searchParams.set("orgId", orgId);
	}

	return new Request(url.toString(), {
		method: request.method,
		headers: request.headers,
		body: request.body,
		duplex: "half", // Required for streaming body
	} as RequestInit);
}
