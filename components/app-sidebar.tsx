"use client"

import { UserButton } from "@clerk/nextjs"
import { cn } from "cn"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent />
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
                    "w-full min-w-0 flex-row-reverse justify-end gap-2",
                  userButtonAvatarBox: "size-6 shrink-0",
                  userButtonOuterIdentifier:
                    "truncate ps-0 text-sm font-medium text-inherit",
                },
              }}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
