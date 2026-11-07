"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatLoadTranscriptParams,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"
import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createGroupChatSchema,
  type CreateGroupChat,
} from "@/db/schema"
import type { chatAgent } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// chatId comes from the browser, so bind it to the signed-in user
async function assertChatOwner(chatId: string) {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) throw new Error("Unauthorized")

  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true },
  })
  if (!row) throw new Error("Chat not found")
}

// Creates the session and its first run; idempotent per chat id
export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertChatOwner(params.chatId)
  return start(params)
}

// The transport calls this to refresh an expired session token
export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

// Reads the chat's saved history from transcript storage
export async function loadChatTranscript(params: ChatLoadTranscriptParams) {
  await assertChatOwner(params.chatId)
  return load(params)
}

export type CreateGroupChatResult =
  | { ok: true; chatId: string }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof CreateGroupChat, string[]>>
    }

export async function createGroupChat(
  input: CreateGroupChat
): Promise<CreateGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to create a group chat." }
  }

  const parsed = createGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Bot ids come from the browser, so keep only the user's own
  const botIds = [...new Set(parsed.data.botIds)]
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
  if (owned.length !== botIds.length) {
    return { ok: false, error: "Some of those bots no longer exist." }
  }

  const chatId = await db.transaction(async (tx) => {
    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name: parsed.data.name })
      .returning({ id: chats.id })

    await tx
      .insert(chatMembers)
      .values(botIds.map((botId) => ({ chatId: chat.id, botId })))

    return chat.id
  })

  // The chat list lives in the dashboard layout, so refresh it on every route
  revalidatePath("/", "layout")
  return { ok: true, chatId }
}
