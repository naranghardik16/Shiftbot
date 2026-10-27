"use client"

import { useState } from "react"
import Link from "next/link"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { UserButton } from "@clerk/nextjs"
import { cn } from "cn"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { ChatSearch } from "@/components/chat-search"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar"
import type { ChatListItem } from "@/queries/bot"

export function AppSidebar({ chats }: { chats: ChatListItem[] }) {
  // The menu unmounts its items on close, so they open the dialog through a handle
  const [botDialog] = useState(() => DialogPrimitive.createHandle())

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Create"
                className="self-end aria-expanded:not-hover:bg-transparent"
              />
            }
          >
            <PlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={() => botDialog.open(null)}>
              <PlusIcon />
              Create new bot
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UsersIcon />
              Create group chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <BotDialog handle={botDialog} />
        <ChatSearch chats={chats} />
      </SidebarHeader>
      <SidebarContent>
        {chats.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      size="lg"
                      className="h-auto gap-3"
                      tooltip={chat.name}
                      render={<Link href={`/chats/${chat.id}`} />}
                    >
                      <ChatAvatar seed={chat.avatar} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate font-medium">
                            {chat.name}
                          </span>
                          {/* Relative to now, so server and client can differ */}
                          <time
                            dateTime={chat.lastMessageAt.toISOString()}
                            suppressHydrationWarning
                            className="ms-auto shrink-0 text-xs text-muted-foreground"
                          >
                            {formatDistanceToNowStrict(chat.lastMessageAt)}
                          </time>
                        </div>
                        {chat.lastMessagePreview && (
                          <span className="truncate text-xs text-muted-foreground">
                            {chat.lastMessagePreview}
                          </span>
                        )}
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton
              showName
              appearance={{
                elements: {
                  rootBox: "w-full",
                  userButtonTrigger: cn(
                    sidebarMenuButtonVariants({ size: "lg" }),
                    "aria-expanded:bg-sidebar-accent aria-expanded:text-sidebar-accent-foreground"
                  ),
                  userButtonBox:
                    "w-full min-w-0 flex-row-reverse justify-end gap-2 group-data-[collapsible=icon]:justify-center",
                  userButtonAvatarBox:
                    "size-6 shrink-0 group-data-[collapsible=icon]:size-8",
                  userButtonOuterIdentifier:
                    "truncate ps-0 text-sm font-medium text-inherit group-data-[collapsible=icon]:hidden",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
