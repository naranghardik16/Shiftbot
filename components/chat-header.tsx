import { chatAvatarSrc } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotDialog } from "@/components/edit-bot-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chat"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <h1 className="-ms-2.5 min-w-0">
        <EditBotDialog
          bot={chat.bot}
          trigger={
            <Button
              variant="ghost"
              size="lg"
              aria-label={`Edit ${chat.bot.name}`}
              className="max-w-full justify-start"
            >
              <Avatar size="sm">
                <AvatarImage src={chatAvatarSrc(chat.avatar)} alt="" />
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
