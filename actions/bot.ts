"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
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
