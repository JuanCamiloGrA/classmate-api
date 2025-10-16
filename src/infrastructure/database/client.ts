import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export class DatabaseFactory {
	private constructor() {}

	static create(binding: D1Database) {
		return drizzle(binding, { schema });
	}
}

export type Database = ReturnType<typeof DatabaseFactory.create>;
