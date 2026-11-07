"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import type { ChatListItem } from "@/queries/bot"

// The server can't know the platform, so it renders the Mac shortcut
function useIsMac() {
  return useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => true
  )
}

export function ChatSearch({ chats }: { chats: ChatListItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const isMac = useIsMac()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      {/* Styled as the Input, keeping the outline button's hover */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground transition-colors group-data-[collapsible=icon]:hidden md:text-sm dark:bg-input/30"
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <KbdGroup className="ms-auto">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      {/* The collapsed sidebar only has room for the icon */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="hidden group-data-[collapsible=icon]:inline-flex"
      >
        <SearchIcon />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Search for a chat to open"
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            {chats.length > 0 && (
              <CommandGroup heading="Chats">
                {chats.map((chat) => (
                  <CommandItem
                    key={chat.id}
                    value={`${chat.name} ${chat.id}`}
                    onSelect={() => {
                      setOpen(false)
                      router.push(`/chats/${chat.id}`)
                    }}
                  >
                    {chat.kind === "group" ? (
                      <GroupChatAvatar
                        seeds={chat.avatars}
                        className="size-6"
                      />
                    ) : (
                      <ChatAvatar seed={chat.avatars[0]} className="size-6" />
                    )}
                    <span className="truncate">{chat.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
