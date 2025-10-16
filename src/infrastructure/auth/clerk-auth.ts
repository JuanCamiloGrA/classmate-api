import type { ClerkClient, SessionAuthObject } from "@clerk/backend";
import { createClerkClient } from "@clerk/backend";
import type { AuthenticateRequestOptions } from "@clerk/backend/internal";
import { TokenType } from "@clerk/backend/internal";
import type { Context, MiddlewareHandler } from "hono";

import {
	resolveSecretBinding,
	type SecretsStoreBinding,
} from "../../config/bindings";

export type ClerkAuthVariables = {
	clerk: ClerkClient;
	clerkAuth: () => SessionAuthObject | null;
};

export const getAuth = (c: Context): SessionAuthObject | null => {
	const authFn = c.get("clerkAuth");
	return authFn();
};

type ClerkEnv = {
	CLERK_SECRET_KEY: SecretsStoreBinding;
	CLERK_PUBLISHABLE_KEY: SecretsStoreBinding;
	CLERK_API_URL?: string;
	CLERK_API_VERSION?: string;
};

type ClerkMiddlewareOptions = Omit<AuthenticateRequestOptions, "acceptsToken">;

export const clerkMiddleware = (
	options?: ClerkMiddlewareOptions,
): MiddlewareHandler => {
	return async (c, next) => {
		const clerkEnv = c.env as ClerkEnv;
		const secretKey =
			options?.secretKey ??
			(await resolveSecretBinding(
				clerkEnv.CLERK_SECRET_KEY,
				"CLERK_SECRET_KEY",
			));
		const publishableKey =
			options?.publishableKey ??
			(await resolveSecretBinding(
				clerkEnv.CLERK_PUBLISHABLE_KEY,
				"CLERK_PUBLISHABLE_KEY",
			));
		const apiUrl = options?.apiUrl ?? clerkEnv.CLERK_API_URL;
		const apiVersion = options?.apiVersion ?? clerkEnv.CLERK_API_VERSION;

		if (!secretKey) {
			throw new Error("Missing Clerk Secret key");
		}

		if (!publishableKey) {
			throw new Error("Missing Clerk Publishable key");
		}

		const clerkOptions = {
			...options,
			apiUrl,
			apiVersion,
			secretKey,
			publishableKey,
		};

		const clerkClient = createClerkClient(clerkOptions);

		const requestState = await clerkClient.authenticateRequest(c.req.raw, {
			...clerkOptions,
			acceptsToken: TokenType.SessionToken,
		});

		if (requestState.headers) {
			requestState.headers.forEach((value, key) => {
				c.res.headers.append(key, value);
			});

			const locationHeader = requestState.headers.get("location");

			if (locationHeader) {
				return c.redirect(locationHeader, 307);
			} else if (requestState.status === "handshake") {
				throw new Error("Clerk: unexpected handshake without redirect");
			}
		}

		// Options will be added soon
		c.set("clerkAuth", () => requestState.toAuth());
		c.set("clerk", clerkClient);

		await next();
	};
};
