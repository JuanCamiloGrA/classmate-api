import { z } from "zod";

const envSchema = z.object({
	ENVIRONMENT: z.enum(["development", "staging", "production"]),
	R2_PRESIGNED_URL_EXPIRATION_SECONDS: z
		.string()
		.optional()
		.default("300")
		.transform((val) => Number.parseInt(val, 10)),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(env: unknown): AppEnv {
	return envSchema.parse(env);
}
