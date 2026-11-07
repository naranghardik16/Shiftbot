import { chatAvatarSrc } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotDialog } from "@/components/edit-bot-dialog"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chat"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  // Group chats have no single bot to edit and no desktop to show
  if (chat.kind === "group") {
    return (
      <header className="flex h-12 shrink-0 items-center gap-2 px-4">
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <GroupChatAvatar
            seeds={chat.bots.map((bot) => bot.avatar)}
            className="size-6"
          />
          <span className="truncate">{chat.name}</span>
        </h1>
      </header>
    )
  }

  const [bot] = chat.bots
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <h1 className="-ms-2.5 min-w-0">
        <EditBotDialog
          bot={bot}
          trigger={
            <Button
              variant="ghost"
              size="lg"
              aria-label={`Edit ${bot.name}`}
              className="max-w-full justify-start"
            >
              <Avatar size="sm">
                <AvatarImage src={chatAvatarSrc(bot.avatar)} alt="" />
                <AvatarFallback>
                  {chat.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{chat.name}</span>
            </Button>
          }
        />
      </h1>
      <DesktopPanelToggle className="ms-auto text-muted-foreground" />
    </header>
  )
}
