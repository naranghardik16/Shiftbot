"use client"

import { useId } from "react"
import { ShuffleIcon } from "lucide-react"
import { Controller, useWatch, type UseFormReturn } from "react-hook-form"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { CreateBot } from "@/db/schema"

const newSeed = () => crypto.randomUUID()

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

// The template picker and the face, name, job and instructions fields shared by
// the create and edit dialogs
function BotFields({ form }: { form: UseFormReturn<CreateBot> }) {
  // Both dialogs can be on one page, so ids can't be hard-coded
  const id = useId()
  const [avatar, job, instructions] = useWatch({
    control: form.control,
    name: ["avatar", "job", "instructions"],
  })
  // A template stays selected only while its fields are untouched
  const template = templates.find(
    (t) => t.job === job && t.instructions === instructions
  )

  return (
    <>
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
          <ToggleGroupItem key={t.job} value={t.job} className="rounded-full">
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
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              {...field}
              id={`${id}-name`}
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
            <FieldLabel htmlFor={`${id}-job`}>Job</FieldLabel>
            <Input
              {...field}
              id={`${id}-job`}
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
            <FieldLabel htmlFor={`${id}-instructions`}>
              How it should work
            </FieldLabel>
            <Textarea
              {...field}
              value={field.value ?? ""}
              id={`${id}-instructions`}
              placeholder="Answer briefly, cite sources, and ask before running anything destructive."
              className="min-h-24"
              aria-invalid={fieldState.invalid}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </>
  )
}

export { BotFields, newSeed }
