import { SidebarTrigger } from "@/components/ui/sidebar"

// Pages without a header of their own need a way to open the sidebar, which
// is a hidden sheet on phones
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 box-content flex h-12 shrink-0 items-center bg-background px-4 pt-[env(safe-area-inset-top)] md:hidden">
      <SidebarTrigger className="-ms-1.5" />
    </header>
  )
}
