import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import * as schema from "./schema.js";

export type StackLensDatabase = NodePgDatabase<typeof schema>;

export function createStackLensDatabase(
  pool: Pool,
): StackLensDatabase & { readonly $client: Pool } {
  return drizzle({ client: pool, schema });
}
