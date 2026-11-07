import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  return (
    <DesktopPanelProvider key={chat.bot.id} botId={chat.bot.id}>
      {/* The group sets an inline height of 100%, so the parent fixes it to the
          viewport; only the chat messages scroll */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="chat" minSize="30%">
            <div className="flex h-full flex-col">
              <ChatHeader chat={chat} />
              <Chat key={chat.id} id={chat.id} />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <DesktopPanel botName={chat.bot.name} />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
