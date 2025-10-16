import { z } from "zod";

const envSchema = z.object({
	ENVIRONMENT: z.enum(["development", "staging", "production"]),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(env: unknown): AppEnv {
	return envSchema.parse(env);
}
