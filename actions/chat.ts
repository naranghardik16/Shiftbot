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
import { redirect } from "next/navigation"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createGroupChatSchema,
  type CreateGroupChat,
} from "@/db/schema"
import {
  billingErrorText,
  BOT_FEATURES,
  hasFeatures,
  limitReached,
  upgradeRequired,
  type BillingFailure,
} from "@/lib/billing"
import { getAllowance } from "@/lib/usage"
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

// Talking to a bot runs the model, so it needs a paid plan with AI allowance
// left this period
async function chatBlock(): Promise<BillingFailure | null> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated) throw new Error("Unauthorized")
  if (!hasFeatures(has, BOT_FEATURES)) {
    return upgradeRequired("Chatting with bots is part of the Pro plan.")
  }
  const allowance = await getAllowance(userId)
  if (!allowance) {
    return upgradeRequired("Chatting with bots is part of the Pro plan.")
  }
  if (allowance.remaining.aiMicros === 0) {
    return limitReached("You've used this period's AI allowance.")
  }
  return null
}

// The browser asks before each message so it can show the right toast
export async function checkChatAllowance(): Promise<
  { ok: true } | BillingFailure
> {
  return (await chatBlock()) ?? { ok: true }
}

// Session tokens go only to users who may chat; the agent re-checks every turn
async function assertCanChat() {
  const block = await chatBlock()
  if (block) throw new Error(billingErrorText(block.billing, block.error))
}

// Creates the session and its first run; idempotent per chat id
export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertChatOwner(params.chatId)
  await assertCanChat()
  return start(params)
}

// The transport calls this to refresh an expired session token, so a
// cancelled plan stops working once the current token runs out
export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  await assertCanChat()
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

// Bot ids come from the browser, so accept them only if they're all the user's
// own. Null if any isn't
async function ownedBotIds(ids: string[], userId: string) {
  const botIds = [...new Set(ids)]
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(inArray(bots.id, botIds), eq(bots.userId, userId)))
  return owned.length === botIds.length ? botIds : null
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

  const botIds = await ownedBotIds(parsed.data.botIds, userId)
  if (!botIds) {
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

export type UpdateGroupChatResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof CreateGroupChat, string[]>>
    }

export async function updateGroupChat(
  id: string,
  input: CreateGroupChat
): Promise<UpdateGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to edit a group chat." }
  }

  const parsed = createGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const botIds = await ownedBotIds(parsed.data.botIds, userId)
  if (!botIds) {
    return { ok: false, error: "Some of those bots no longer exist." }
  }

  const found = await db.transaction(async (tx) => {
    // Scoping to userId and kind keeps users to their own group chats
    const updated = await tx
      .update(chats)
      .set({ name: parsed.data.name })
      .where(
        and(eq(chats.id, id), eq(chats.userId, userId), eq(chats.kind, "group"))
      )
      .returning({ id: chats.id })
    if (updated.length === 0) return false

    await tx
      .delete(chatMembers)
      .where(
        and(eq(chatMembers.chatId, id), notInArray(chatMembers.botId, botIds))
      )
    // Members who stay keep their join time, so the member order holds
    await tx
      .insert(chatMembers)
      .values(botIds.map((botId) => ({ chatId: id, botId })))
      .onConflictDoNothing()
    return true
  })
  if (!found) return { ok: false, error: "Group chat not found." }

  // The name and faces show in the sidebar and in the chat header
  revalidatePath("/", "layout")
  return { ok: true }
}

export type DeleteGroupChatResult = { ok: false; error: string }

// Redirects home on success, since the chat no longer exists. The bots stay
export async function deleteGroupChat(
  id: string
): Promise<DeleteGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    return { ok: false, error: "Sign in to delete a group chat." }
  }

  // Membership rows cascade
  const deleted = await db
    .delete(chats)
    .where(
      and(eq(chats.id, id), eq(chats.userId, userId), eq(chats.kind, "group"))
    )
    .returning({ id: chats.id })
  if (deleted.length === 0) return { ok: false, error: "Group chat not found." }

  revalidatePath("/", "layout")
  redirect("/")
}
