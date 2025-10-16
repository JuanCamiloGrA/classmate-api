import { fromHono } from "chanfana";

import type { Bindings } from "./config/bindings";
import { createApp } from "./interfaces";

const honoApp = createApp({});

// Setup OpenAPI registry
fromHono(honoApp, {
	docs_url: "/",
});

export default {
	async fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
		return honoApp.fetch(request, env, ctx);
	},
};
