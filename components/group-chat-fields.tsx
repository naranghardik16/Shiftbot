"use client"

import { useId } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"

import { ChatAvatar } from "@/components/chat-avatar"
import { Checkbox } from "@/components/ui/checkbox"
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
import type { CreateGroupChat } from "@/db/schema"

type BotOption = { id: string; name: string; avatar: string }

// The name and member fields shared by the create and edit dialogs
function GroupChatFields({
  form,
  bots,
}: {
  form: UseFormReturn<CreateGroupChat>
  // Every bot the user has, to pick members from
  bots: BotOption[]
}) {
  // Both dialogs can be on one page, so ids can't be hard-coded
  const id = useId()

  return (
    <>
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
    </>
  )
}

export { GroupChatFields }
