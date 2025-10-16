import { fromHono } from "chanfana";

import type { Bindings } from "./config/bindings";
import { createApp } from "./interfaces";
import {
	CreateProfileEndpoint,
	GetProfileEndpoint,
} from "./interfaces/http/routes/profiles";
import {
	CreateTermEndpoint,
	HardDeleteTermEndpoint,
	ListTermsEndpoint,
	SoftDeleteTermEndpoint,
	UpdateTermEndpoint,
} from "./interfaces/http/routes/terms";

export default {
	async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
		const honoApp = createApp({});

		// Setup OpenAPI registry
		const apiApp = fromHono(honoApp, {
			docs_url: "/",
			openapi_url: "/openapi.json",
			schema: {
				info: {
					title: "Classmate API",
					version: "1.0.0",
					description: "API for educational profile and content management",
				},
				servers: [
					{
						url: new URL(request.url).origin,
						description: "Current Server",
					},
				],
			},
		});

		// Register OpenAPI endpoints
		// Profile endpoints
		apiApp.post("/profiles", CreateProfileEndpoint);
		apiApp.get("/profiles/me", GetProfileEndpoint);

		// Term endpoints
		apiApp.get("/terms", ListTermsEndpoint);
		apiApp.post("/terms", CreateTermEndpoint);
		apiApp.put("/terms/:id", UpdateTermEndpoint);
		apiApp.delete("/terms/:id", SoftDeleteTermEndpoint);
		apiApp.delete("/terms/:id/hard", HardDeleteTermEndpoint);

		return apiApp.fetch(request, env, ctx);
	},
};
