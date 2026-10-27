import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats, type CreateBot } from "@/db/schema"

export type ChatDetail = {
  id: string
  name: string
  avatar: string
  // The bot shown in the header, in the shape the bot form edits
  bot: CreateBot & { id: string }
}

// One of the signed-in user's chats, or null if it isn't theirs
export async function getChat(chatId: string): Promise<ChatDetail | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return null

  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true, name: true },
    with: {
      // Direct chats have one bot; group chats show their first member for now
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        with: {
          bot: {
            columns: {
              id: true,
              name: true,
              avatar: true,
              job: true,
              instructions: true,
            },
          },
        },
      },
    },
  })

  const bot = row?.members[0]?.bot
  if (!row || !bot) return null

  return { id: row.id, name: row.name ?? bot.name, avatar: bot.avatar, bot }
}
