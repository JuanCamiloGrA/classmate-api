import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		globals: true,
		include: ["src/**/*.test.ts"],
		// Exclude integration tests that need full DO support for now
		exclude: ["src/**/*.integration.test.ts", "node_modules"],
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
				main: "./src/index.ts",
				miniflare: {
					durableObjects: {
						ClassmateAgent: "ClassmateAgent",
					},
				},
			},
		},
	},
});
