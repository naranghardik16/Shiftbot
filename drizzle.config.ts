import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

import { assertVerifyFull } from "./db/ssl"

config({ path: ".env.local" })

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set in .env.local")
}
assertVerifyFull("DATABASE_URL_UNPOOLED", process.env.DATABASE_URL_UNPOOLED)

export default defineConfig({
  schema: "./db/schema.ts",
  dialect: "postgresql",
  // Direct (non-pooled) connection: schema changes need session state PgBouncer drops
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED },
})
