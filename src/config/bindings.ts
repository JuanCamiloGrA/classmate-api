import type { D1Database } from "@cloudflare/workers-types";
import type { Database } from "../infrastructure/database/client";

export type Bindings = {
	DB: D1Database;
	ENVIRONMENT: "development" | "staging" | "production";
	CLERK_SECRET_KEY: string;
	CLERK_PUBLISHABLE_KEY: string;
	ALLOWED_ORIGIN: string;
};

export type Variables = {
	userId?: string;
	db?: Database;
	requestId?: string;
};
