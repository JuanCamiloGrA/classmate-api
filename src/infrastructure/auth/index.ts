export type { ClerkAuthVariables } from "./clerk-auth";
export { clerkMiddleware, getAuth } from "./clerk-auth";

declare module "hono" {
	interface ContextVariableMap {
		clerk: import("@clerk/backend").ClerkClient;
		clerkAuth: () => import("@clerk/backend").SessionAuthObject | null;
	}
}
