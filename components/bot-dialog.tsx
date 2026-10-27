"use client"

import { useState, type ReactElement } from "react"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createBotSchema, type CreateBot } from "@/db/schema"

const templates = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Point out bugs first, then risky patterns. Suggest concrete fixes and skip style nits.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten the prose without changing my voice. Explain each edit in a line.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach step by step. Ask a question to check understanding before moving on.",
  },
]

const newSeed = () => crypto.randomUUID()

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
  const [avatar, job, instructions] = useWatch({
    control: form.control,
    name: ["avatar", "job", "instructions"],
  })
  // A template stays selected only while its fields are untouched
  const template = templates.find(
    (t) => t.job === job && t.instructions === instructions
  )

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
            <ToggleGroup
              aria-label="Start from a template"
              variant="outline"
              className="flex-wrap"
              value={template ? [template.job] : []}
              onValueChange={([value]) => {
                const picked = templates.find((t) => t.job === value)
                if (!picked) return
                const opts = { shouldDirty: true, shouldValidate: true }
                form.setValue("job", picked.job, opts)
                form.setValue("instructions", picked.instructions, opts)
              }}
            >
              {templates.map((t) => (
                <ToggleGroupItem
                  key={t.job}
                  value={t.job}
                  className="rounded-full"
                >
                  {t.job}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Field orientation="horizontal">
              <ChatAvatar seed={avatar} className="size-12" />
              <FieldContent>
                <FieldTitle>Face</FieldTitle>
                <FieldDescription>
                  Shuffle until you find one you like.
                </FieldDescription>
              </FieldContent>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  form.setValue("avatar", newSeed(), { shouldDirty: true })
                }
              >
                <ShuffleIcon data-icon="inline-start" />
                Shuffle
              </Button>
            </Field>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
                    placeholder="Ada"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="job"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
                    placeholder="Research assistant"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="instructions"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
                    placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
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
