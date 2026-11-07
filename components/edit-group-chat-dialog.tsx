"use client"

import { useState, useTransition, type ReactElement } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { deleteGroupChat, updateGroupChat } from "@/actions/chat"
import { GroupChatFields } from "@/components/group-chat-fields"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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

function EditGroupChatDialog({
  trigger,
  chat,
  bots,
}: {
  trigger: ReactElement
  chat: CreateGroupChat & { id: string }
  // Every bot the user has, to pick members from
  bots: BotListItem[]
}) {
  const [open, setOpen] = useState(false)
  // Read from props on every reset, so a saved edit becomes the new starting point
  const savedValues = (): CreateGroupChat => ({
    name: chat.name,
    botIds: chat.botIds,
  })
  const form = useForm<CreateGroupChat>({
    resolver: zodResolver(createGroupChatSchema),
    defaultValues: savedValues(),
  })

  async function onSubmit(values: CreateGroupChat) {
    const result = await updateGroupChat(chat.id, values)
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof CreateGroupChat, { message: messages?.[0] })
      }
      toast.add({ title: "Couldn't save group", description: result.error })
      return
    }
    toast.add({ title: `${values.name} is updated` })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => !open && form.reset(savedValues())}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {chat.name}</DialogTitle>
          <DialogDescription>
            Rename the group or change which bots are in it.
          </DialogDescription>
        </DialogHeader>
        <form id="edit-group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <GroupChatFields form={form} bots={bots} />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DeleteGroupChatButton chat={chat} />
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="edit-group-chat-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGroupChatButton({
  chat,
}: {
  chat: { id: string; name: string }
}) {
  const [isDeleting, startDelete] = useTransition()

  function onDelete() {
    startDelete(async () => {
      // Only returns on failure; on success the action redirects home
      const result = await deleteGroupChat(chat.id)
      if (result && !result.ok) {
        toast.add({ title: "Couldn't delete group", description: result.error })
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive" className="sm:me-auto" />}
      >
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the group chat. The bots in it and their own chats
            stay. You can&apos;t undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { EditGroupChatDialog }
