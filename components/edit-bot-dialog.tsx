"use client"

import { useState, useTransition, type ReactElement } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { deleteBot, updateBot } from "@/actions/bot"
import { BotFields } from "@/components/bot-fields"
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
import { createBotSchema, type CreateBot } from "@/db/schema"

function EditBotDialog({
  trigger,
  bot,
}: {
  trigger: ReactElement
  bot: CreateBot & { id: string }
}) {
  const [open, setOpen] = useState(false)
  // Read from props on every reset, so a saved edit becomes the new starting point
  const savedValues = (): CreateBot => ({
    name: bot.name,
    avatar: bot.avatar,
    job: bot.job,
    instructions: bot.instructions,
  })
  const form = useForm<CreateBot>({
    resolver: zodResolver(createBotSchema),
    defaultValues: savedValues(),
  })

  async function onSubmit(values: CreateBot) {
    const result = await updateBot(bot.id, values)
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof CreateBot, { message: messages?.[0] })
      }
      toast.add({ title: "Couldn't save bot", description: result.error })
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {bot.name}</DialogTitle>
          <DialogDescription>Change its face, name, or job.</DialogDescription>
        </DialogHeader>
        <form id="edit-bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <BotFields form={form} />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DeleteBotButton bot={bot} />
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="edit-bot-form"
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

function DeleteBotButton({ bot }: { bot: { id: string; name: string } }) {
  const [isDeleting, startDelete] = useTransition()

  function onDelete() {
    startDelete(async () => {
      // Only returns on failure; on success the action redirects home
      const result = await deleteBot(bot.id)
      if (result && !result.ok) {
        toast.add({ title: "Couldn't delete bot", description: result.error })
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
          <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the bot and its chat. You can&apos;t undo this.
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

export { EditBotDialog }
