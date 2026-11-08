import { auth } from "@clerk/nextjs/server"
import { PlusIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { MobileHeader } from "@/components/mobile-header"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default async function Page() {
  await auth.protect()
  const seed = crypto.randomUUID()

  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={seed} className="size-12" />
          </EmptyMedia>
          <EmptyTitle>Meet your first bot</EmptyTitle>
          <EmptyDescription>
            Every bot gets its own personality, memory, and face. Spin one up
            and start the conversation.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog
            trigger={
              <Button variant="secondary">
                <PlusIcon data-icon="inline-start" />
                Create a new bot
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    </div>
  )
}
