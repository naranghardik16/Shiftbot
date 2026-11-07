import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, chats, type Chat } from "@/db/schema"

export type BotListItem = {
  id: string
  name: string
  avatar: string
}

// The signed-in user's bots, oldest first
export async function getBots(): Promise<BotListItem[]> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) return []

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
    columns: { id: true, name: true, avatar: true },
  })
}

export type ChatListItem = {
  id: string
  kind: Chat["kind"]
  name: string
  // Face seeds of the members in join order; direct chats have one
  avatars: string[]
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
      kind: true,
      name: true,
      lastMessagePreview: true,
      lastMessageAt: true,
    },
    with: {
      // Group members join together, so the bot id breaks the tie
      members: {
        orderBy: [asc(chatMembers.joinedAt), asc(chatMembers.botId)],
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const first = members[0]?.bot
    if (!first) return []
    return [
      {
        ...chat,
        name: chat.name ?? first.name,
        avatars: members.map((member) => member.bot.avatar),
      },
    ]
  })
}
