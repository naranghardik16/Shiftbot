"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { bots, createBotSchema, type CreateBot } from "@/db/schema"

export type CreateBotResult =
  | { ok: true; id: string }
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

  const [bot] = await db
    .insert(bots)
    .values({
      ...parsed.data,
      instructions: parsed.data.instructions || null,
      userId,
    })
    .returning({ id: bots.id })

  revalidatePath("/")
  return { ok: true, id: bot.id }
}
