import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader chat={chat} />
      <Chat key={chat.id} id={chat.id} />
    </div>
  )
}
