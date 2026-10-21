import { parseEnv } from "@neon/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import config from "@/neon"
import * as schema from "./schema"

// Pooled connection for app traffic; migrations use the direct URL (drizzle.config.ts)
const { postgres } = parseEnv(config, ["DATABASE_URL"])

// Reuse the pool across dev hot reloads
const globalForDb = globalThis as unknown as { pool?: Pool }
const pool =
  globalForDb.pool ?? new Pool({ connectionString: postgres.databaseUrl })
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool

export const db = drizzle({ client: pool, schema })
