import type { Context } from "hono";

import type { Bindings, Variables } from "./config/bindings";

export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
