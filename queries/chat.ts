import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats, type Chat, type CreateBot } from "@/db/schema"

// A member bot, in the shape the bot form edits
export type ChatBot = CreateBot & { id: string }

export type ChatDetail = {
  id: string
  kind: Chat["kind"]
  name: string
  // In join order; direct chats have exactly one
  bots: ChatBot[]
}

// One of the signed-in user's chats, or null if it isn't theirs
export async function getChat(chatId: string): Promise<ChatDetail | null> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return null

  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true, kind: true, name: true },
    with: {
      // Group members join together, so the bot id breaks the tie
      members: {
        orderBy: [asc(chatMembers.joinedAt), asc(chatMembers.botId)],
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

  const bots = row?.members.map((member) => member.bot) ?? []
  if (!row || bots.length === 0) return null

  return {
    id: row.id,
    kind: row.kind,
    name: row.name ?? bots[0].name,
    bots,
  }
}
