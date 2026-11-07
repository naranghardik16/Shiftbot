import { anthropic } from "@ai-sdk/anthropic"
import {
  chat,
  type InferChatUIMessageFromTools,
} from "@trigger.dev/sdk/ai"
import { isStepCount } from "ai"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, type Bot } from "@/db/schema"
import { sandboxAccess } from "@/lib/sandbox"
import { createComputerTools, type ComputerTools } from "./tools"

export type ChatUIMessage = InferChatUIMessageFromTools<ComputerTools>

type BotProfile = Pick<Bot, "name" | "job" | "instructions" | "sandboxId">

function systemPrompt({ name, job, instructions }: BotProfile) {
  return [
    `You are ${name}, a bot whose job is: ${job}.`,
    `You were created by the person you are chatting with to do this job for them. Keep your replies focused on it, and if they ask for something outside it, say so plainly and help as far as it reasonably fits.`,
    instructions
      ? `Your creator gave you these instructions for how to go about the job:\n\n<instructions>\n${instructions}\n</instructions>`
      : null,
    `You have your own computer: a private, isolated Linux sandbox hosted on Daytona, created for you when you were created and deleted along with you. It has its own filesystem, network and processes, and nobody else's work runs in it. It also has a desktop you can see and operate with the mouse and keyboard.`,
    `Use your computer when the job calls for it. Prefer the shell and file tools when they can do the work, and the desktop when something needs a graphical app. Look at the screen before you click or type, and again afterwards to check the result, since screen coordinates are only valid for what is currently shown. Your screenshots are private to you; show the screen only when the person asks to see it.`,
    `Speak as ${name}, in the first person. Don't describe yourself as a generic AI assistant.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// Direct chats have exactly one bot member
async function loadBot(chatId: string): Promise<BotProfile> {
  const [bot] = await db
    .select({
      name: bots.name,
      job: bots.job,
      instructions: bots.instructions,
      sandboxId: bots.sandboxId,
    })
    .from(chatMembers)
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .where(eq(chatMembers.chatId, chatId))
    .limit(1)
  if (!bot) throw new Error(`No bot in chat ${chatId}`)
  return bot
}

// One durable run per chat; history is kept in the platform's transcript
// storage, keyed by chat id
export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // Declared here, not only on streamText, so the screenshot tools'
  // toModelOutput is re-applied to history on later turns. Built per turn so
  // the tools act on this chat's bot's sandbox
  tools: ({ chatId }) =>
    createComputerTools(
      sandboxAccess(async () => (await loadBot(chatId)).sandboxId)
    ),
  // Reload every turn so edits to the bot apply mid-conversation
  onTurnStart: async ({ chatId }) => {
    chat.prompt.set(systemPrompt(await loadBot(chatId)))
  },
  // Use the run argument's streamText, not the one from "ai"; it carries the
  // prompt set above
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      tools,
      abortSignal: signal,
      // Let the bot work through several tool calls before it replies
      stopWhen: isStepCount(50),
    }),
})
