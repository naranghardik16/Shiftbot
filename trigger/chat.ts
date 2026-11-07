import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import {
  isStepCount,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, type Bot } from "@/db/schema"
import { sandboxAccess } from "@/lib/sandbox"
import { createComputerTools, type ComputerTools } from "./tools"

// Which bot wrote a reply, so group chats can show its face and name
export type ChatMessageMetadata = { botId?: string }

export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  UIDataTypes,
  InferUITools<ComputerTools>
>

// Sent with every message. Group chats name the bot the person picked;
// direct chats leave it out
const clientDataSchema = z.object({ botId: z.string().optional() })

type BotProfile = Pick<
  Bot,
  "id" | "name" | "job" | "instructions" | "sandboxId"
> & {
  // The other members' names; empty in direct chats
  others: string[]
}

function systemPrompt({ name, job, instructions, others }: BotProfile) {
  return [
    `You are ${name}, a bot whose job is: ${job}.`,
    `You were created by the person you are chatting with to do this job for them. Keep your replies focused on it, and if they ask for something outside it, say so plainly and help as far as it reasonably fits.`,
    instructions
      ? `Your creator gave you these instructions for how to go about the job:\n\n<instructions>\n${instructions}\n</instructions>`
      : null,
    others.length > 0
      ? `This is a group chat that also includes these bots: ${others.join(", ")}. The person picks which bot answers each message, and this one is for you. Earlier assistant replies may have been written by the other bots, on their own computers, so don't take their work as yours.`
      : null,
    `You have your own computer: a private, isolated Linux sandbox hosted on Daytona, created for you when you were created and deleted along with you. It has its own filesystem, network and processes, and nobody else's work runs in it. It also has a desktop you can see and operate with the mouse and keyboard.`,
    `Use your computer when the job calls for it. Prefer the shell and file tools when they can do the work, and the desktop when something needs a graphical app. Look at the screen before you click or type, and again afterwards to check the result, since screen coordinates are only valid for what is currently shown. Your screenshots are private to you; show the screen only when the person asks to see it.`,
    `Speak as ${name}, in the first person. Don't describe yourself as a generic AI assistant.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// The bot answering this turn: the one picked in the browser, which must be a
// member of the chat, or the first member when none was picked
async function loadBot(chatId: string, botId?: string): Promise<BotProfile> {
  const members = await db
    .select({
      id: bots.id,
      name: bots.name,
      job: bots.job,
      instructions: bots.instructions,
      sandboxId: bots.sandboxId,
      kind: chats.kind,
    })
    .from(chatMembers)
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(eq(chatMembers.chatId, chatId))
    .orderBy(asc(chatMembers.joinedAt), asc(chatMembers.botId))

  const bot = botId ? members.find((member) => member.id === botId) : members[0]
  if (!bot) throw new Error(`Bot ${botId ?? "(any)"} is not in chat ${chatId}`)

  const { kind, ...profile } = bot
  return {
    ...profile,
    others:
      kind === "group"
        ? members.filter((m) => m.id !== bot.id).map((m) => m.name)
        : [],
  }
}

// One durable run per chat; history is kept in the platform's transcript
// storage, keyed by chat id
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  .withClientData({ schema: clientDataSchema })
  .agent({
    id: "chat",
    // Declared here, not only on streamText, so the screenshot tools'
    // toModelOutput is re-applied to history on later turns. Built per turn so
    // the tools act on the sandbox of the bot answering this turn
    tools: ({ chatId, clientData }) =>
      createComputerTools(
        sandboxAccess(
          async () => (await loadBot(chatId, clientData?.botId)).sandboxId
        )
      ),
    // Use the run argument's streamText, not the one from "ai"; it carries the
    // prompt set below. The bot is reloaded every turn so edits to it apply
    // mid-conversation, and so each group message reaches the bot it was for
    run: async ({
      chatId,
      clientData,
      messages,
      tools,
      signal,
      streamText,
    }) => {
      const bot = await loadBot(chatId, clientData?.botId)
      chat.prompt.set(systemPrompt(bot))
      chat.setUIMessageStreamOptions({
        messageMetadata: ({ part }) =>
          part.type === "start" ? { botId: bot.id } : undefined,
      })

      return streamText({
        model: anthropic("claude-sonnet-5-5"),
        messages,
        tools,
        abortSignal: signal,
        // Let the bot work through several tool calls before it replies
        stopWhen: isStepCount(50),
      })
    },
  })
