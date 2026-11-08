import { relations } from "drizzle-orm"
import {
  bigint,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

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
    // Daytona sandbox ID, created with the bot and deleted with it
    sandboxId: text("sandbox_id").notNull().unique(),
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

export const chatKind = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    kind: chatKind("kind").notNull().default("direct"),
    // Null for direct chats, which use the bot's name
    name: text("name"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert

export const insertChatSchema = createInsertSchema(chats, {
  name: (schema) =>
    schema.trim().min(1, "Give it a name.").max(60, "Keep it under 60."),
})

// What a user fills in for a group chat. The name column is nullable because
// direct chats use the bot's name, but a group always has one
export const createGroupChatSchema = insertChatSchema
  .pick({ name: true })
  .extend({
    name: insertChatSchema.shape.name.unwrap(),
    botIds: z.array(z.string()).min(2, "Pick at least two bots."),
  })

export type CreateGroupChat = z.infer<typeof createGroupChatSchema>

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export type ChatMember = typeof chatMembers.$inferSelect
export type NewChatMember = typeof chatMembers.$inferInsert

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, { fields: [chatMembers.chatId], references: [chats.id] }),
  bot: one(bots, { fields: [chatMembers.botId], references: [bots.id] }),
}))

// What a usage event is measured against
export const usageMeter = pgEnum("usage_meter", ["ai", "sandbox"])

// The usage ledger: one append-only row per billable thing that happened. A
// user's usage in a billing period is the sum of their rows created in it
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Clerk user ID
    userId: text("user_id").notNull(),
    meter: usageMeter("meter").notNull(),
    // Unique per event, so a retried write can't count twice
    key: text("key").notNull().unique(),
    // ai: tokens; sandbox: seconds the sandbox was running
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    // What the event cost us, in millionths of a dollar
    costMicros: bigint("cost_micros", { mode: "number" }).notNull(),
    // Not a foreign key: usage stays on the books after the bot is deleted
    botId: text("bot_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("usage_events_user_meter_created_idx").on(
      table.userId,
      table.meter,
      table.createdAt
    ),
  ]
)

export type UsageEvent = typeof usageEvents.$inferSelect
export type NewUsageEvent = typeof usageEvents.$inferInsert
export type UsageMeter = (typeof usageMeter.enumValues)[number]
