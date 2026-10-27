"use client"

import { useState, type ReactElement } from "react"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { BotFields, newSeed } from "@/components/bot-fields"
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

function emptyBot(): CreateBot {
  return { name: "", avatar: newSeed(), job: "", instructions: "" }
}

function BotDialog({
  trigger,
  handle,
}: {
  trigger?: ReactElement
  // Lets triggers that unmount before the dialog opens, like menu items, open it
  handle?: DialogPrimitive.Handle<unknown>
}) {
  const [open, setOpen] = useState(false)
  const form = useForm<CreateBot>({
    resolver: zodResolver(createBotSchema),
    defaultValues: emptyBot(),
  })

  async function onSubmit(values: CreateBot) {
    const result = await createBot(values)
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof CreateBot, { message: messages?.[0] })
      }
      toast.add({ title: "Couldn't create bot", description: result.error })
      return
    }
    toast.add({ title: `${values.name} is ready` })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(open) => !open && form.reset(emptyBot())}
      handle={handle}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <BotFields form={form} />
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="bot-form"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Spinner data-icon="inline-start" />
            )}
            Create bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
