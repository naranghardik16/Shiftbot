import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getBots } from "@/queries/bot"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const [chat, allBots] = await Promise.all([getChat(chatId), getBots()])
  if (!chat) notFound()

  const bots = chat.bots.map(({ id, name, avatar }) => ({ id, name, avatar }))

  // Group chats have no single bot whose desktop to show
  if (chat.kind === "group") {
    return (
      <div className="flex h-svh flex-col">
        <ChatHeader chat={chat} bots={allBots} />
        <Chat key={chat.id} id={chat.id} bots={bots} />
      </div>
    )
  }

  const [bot] = chat.bots
  return (
    <DesktopPanelProvider key={bot.id} botId={bot.id}>
      {/* The group sets an inline height of 100%, so the parent fixes it to the
          viewport; only the chat messages scroll */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full flex-col">
              <ChatHeader chat={chat} bots={allBots} />
              <Chat key={chat.id} id={chat.id} bots={bots} />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel botName={bot.name} />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
