"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import {
  bots,
  chatMembers,
  chats,
  createBotSchema,
  type CreateBot,
} from "@/db/schema"

export type CreateBotResult =
  | { ok: true; id: string; chatId: string }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof CreateBot, string[]>>
    }

export async function createBot(input: CreateBot): Promise<CreateBotResult> {
  // Server Actions are public endpoints: check auth before anything else
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return { ok: false, error: "Sign in to create a bot." }

  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Every bot starts with a direct chat; create all three rows or none
  const { botId, chatId } = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({
        ...parsed.data,
        instructions: parsed.data.instructions || null,
        userId,
      })
      .returning({ id: bots.id })

    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "direct" })
      .returning({ id: chats.id })

    await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

    return { botId: bot.id, chatId: chat.id }
  })

  // The chat list lives in the dashboard layout, so refresh it on every route
  revalidatePath("/", "layout")
  return { ok: true, id: botId, chatId }
}

export type UpdateBotResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof CreateBot, string[]>>
    }

export async function updateBot(
  id: string,
  input: CreateBot
): Promise<UpdateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return { ok: false, error: "Sign in to edit a bot." }

  const parsed = createBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Scoping to userId keeps users from editing bots that aren't theirs
  const updated = await db
    .update(bots)
    .set({ ...parsed.data, instructions: parsed.data.instructions || null })
    .where(and(eq(bots.id, id), eq(bots.userId, userId)))
    .returning({ id: bots.id })
  if (updated.length === 0) return { ok: false, error: "Bot not found." }

  // The bot's name and face show in the sidebar and in every chat header
  revalidatePath("/", "layout")
  return { ok: true }
}

export type DeleteBotResult = { ok: false; error: string }

// Redirects home on success, since the bot's chat no longer exists
export async function deleteBot(id: string): Promise<DeleteBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return { ok: false, error: "Sign in to delete a bot." }

  const deleted = await db.transaction(async (tx) => {
    // Membership rows cascade, but the bot's direct chats would be left empty
    const directChats = tx
      .select({ id: chatMembers.chatId })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(
        and(
          eq(chatMembers.botId, id),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )
    await tx.delete(chats).where(inArray(chats.id, directChats))

    return tx
      .delete(bots)
      .where(and(eq(bots.id, id), eq(bots.userId, userId)))
      .returning({ id: bots.id })
  })
  if (deleted.length === 0) return { ok: false, error: "Bot not found." }

  revalidatePath("/", "layout")
  redirect("/")
}
