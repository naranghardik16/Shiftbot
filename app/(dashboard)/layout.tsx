import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getBots, getChats } from "@/queries/bot"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [chats, bots] = await Promise.all([getChats(), getBots()])
  // Restore the collapsed state on the server so the sidebar doesn't jump on load
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar chats={chats} bots={bots} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
