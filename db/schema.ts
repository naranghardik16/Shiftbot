import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import type { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    // Seed for the bot's generated face
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text("job").notNull(),
    // How it should go about the job
    instructions: text("instructions"),
    // Sandbox provider ID, created lazily
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export type Bot = typeof bots.$inferSelect
export type NewBot = typeof bots.$inferInsert

export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) =>
    schema.trim().min(1, "Give it a name.").max(60, "Keep it under 60."),
  avatar: (schema) => schema.min(1),
  job: (schema) =>
    schema.trim().min(1, "Give it a job.").max(80, "Keep it under 80."),
  instructions: (schema) => schema.trim().max(2000, "Keep it under 2000."),
})

// What a user fills in; the server adds the rest
export const createBotSchema = insertBotSchema
  .pick({ name: true, avatar: true, job: true, instructions: true })
  .required({ avatar: true })

export type CreateBot = z.infer<typeof createBotSchema>
