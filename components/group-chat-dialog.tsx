"use client"

import { useId, useState, type ReactElement } from "react"
import { useRouter } from "next/navigation"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
  const id = useId()
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
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                  <Input
                    {...field}
                    id={`${id}-name`}
                    placeholder="Weekend plans"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  {bots.length < 2 && (
                    <FieldDescription>
                      A group needs at least two bots. Create another one first.
                    </FieldDescription>
                  )}
                  <FieldGroup data-slot="checkbox-group">
                    {bots.map((bot) => (
                      <Field
                        key={bot.id}
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id={`${id}-bot-${bot.id}`}
                          checked={field.value.includes(bot.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, bot.id]
                                : field.value.filter((id) => id !== bot.id)
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`${id}-bot-${bot.id}`}
                          className="items-center font-normal"
                        >
                          <ChatAvatar seed={bot.avatar} className="size-6" />
                          {bot.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  <FieldError errors={[fieldState.error]} />
                </FieldSet>
              )}
            />
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
