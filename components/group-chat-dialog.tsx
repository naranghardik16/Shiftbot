"use client"

import { useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { GroupChatFields } from "@/components/group-chat-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { createGroupChatSchema, type CreateGroupChat } from "@/db/schema"
import type { BotListItem } from "@/queries/bot"

const emptyGroupChat = (): CreateGroupChat => ({ name: "", botIds: [] })

function GroupChatDialog({
  bots,
  trigger,
  handle,
}: {
  bots: BotListItem[]
  trigger?: ReactElement
  // Lets triggers that unmount before the dialog opens, like menu items, open it
  handle?: DialogPrimitive.Handle<unknown>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<CreateGroupChat>({
    resolver: zodResolver(createGroupChatSchema),
    defaultValues: emptyGroupChat(),
  })

  async function onSubmit(values: CreateGroupChat) {
    const result = await createGroupChat(values)
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof CreateGroupChat, { message: messages?.[0] })
      }
      toast.add({ title: "Couldn't create group", description: result.error })
      return
    }
    toast.add({ title: `${values.name} is ready` })
    setOpen(false)
    router.push(`/chats/${result.chatId}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => !open && form.reset(emptyGroupChat())}
      handle={handle}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>
        <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <GroupChatFields form={form} bots={bots} />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="group-chat-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
