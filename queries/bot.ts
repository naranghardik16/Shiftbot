import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats } from "@/db/schema"

export type ChatListItem = {
  id: string
  name: string
  avatar: string
  lastMessagePreview: string | null
  lastMessageAt: Date
}

// The signed-in user's chats, most recently active first
export async function getChats(): Promise<ChatListItem[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return []

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    columns: {
      id: true,
      name: true,
      lastMessagePreview: true,
      lastMessageAt: true,
    },
    with: {
      // Direct chats have one bot; group chats show their first member for now
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const bot = members[0]?.bot
    if (!bot) return []
    return [{ ...chat, name: chat.name ?? bot.name, avatar: bot.avatar }]
  })
}
