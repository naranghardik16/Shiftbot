import { chatAvatarSrc } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { EditBotDialog } from "@/components/edit-bot-dialog"
import { EditGroupChatDialog } from "@/components/edit-group-chat-dialog"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import type { BotListItem } from "@/queries/bot"
import type { ChatDetail } from "@/queries/chat"

// Below the status bar when the page draws under it
const headerClassName =
  "box-content flex h-12 shrink-0 items-center gap-2 px-4 pt-[env(safe-area-inset-top)]"

export function ChatHeader({
  chat,
  bots,
}: {
  chat: ChatDetail
  // Every bot the user has, for picking a group's members
  bots: BotListItem[]
}) {
  // Group chats edit the group, not a bot, and have no desktop to show
  if (chat.kind === "group") {
    return (
      <header className={headerClassName}>
        <SidebarTrigger className="-ms-1.5 md:hidden" />
        <h1 className="min-w-0 md:-ms-2.5">
          <EditGroupChatDialog
            chat={{
              id: chat.id,
              name: chat.name,
              botIds: chat.bots.map((bot) => bot.id),
            }}
            bots={bots}
            trigger={
              <Button
                variant="ghost"
                size="lg"
                aria-label={`Edit ${chat.name}`}
                className="max-w-full justify-start"
              >
                <GroupChatAvatar
                  seeds={chat.bots.map((bot) => bot.avatar)}
                  className="size-6"
                />
                <span className="truncate">{chat.name}</span>
              </Button>
            }
          />
        </h1>
      </header>
    )
  }

  const [bot] = chat.bots
  return (
    <header className={headerClassName}>
      <SidebarTrigger className="-ms-1.5 md:hidden" />
      <h1 className="min-w-0 md:-ms-2.5">
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
