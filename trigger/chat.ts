import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import {
  hasToolCall,
  isStepCount,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, type Bot } from "@/db/schema"
import { readMemory, sandboxAccess } from "@/lib/sandbox"
import {
  createComputerTools,
  createHandoffTool,
  createMemoryTool,
} from "./tools"

// Which bot wrote a reply, so group chats can show its face and name
export type ChatMessageMetadata = { botId?: string }

// Sent with every message and handoff. Group chats name the bot that should
// answer; direct chats leave it out
const clientDataSchema = z.object({ botId: z.string().optional() })

// Sent by the browser when a reply ends in a handoff, so the chosen bot
// answers the same message. Its metadata names that bot
const actionSchema = z.object({ type: z.literal("handoff") })

type Member = Pick<Bot, "id" | "name" | "job" | "instructions" | "sandboxId">

type Turn = {
  // The bot answering this turn
  bot: Member
  // Group chats only: the chat's name and the other members
  group: { name: string; others: Member[] } | null
}

// The bot answering this turn: the one picked in the browser, which must be a
// member of the chat, or the first member when none was picked
async function loadTurn(chatId: string, botId?: string): Promise<Turn> {
  const rows = await db
    .select({
      id: bots.id,
      name: bots.name,
      job: bots.job,
      instructions: bots.instructions,
      sandboxId: bots.sandboxId,
      kind: chats.kind,
      chatName: chats.name,
    })
    .from(chatMembers)
    .innerJoin(bots, eq(bots.id, chatMembers.botId))
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(eq(chatMembers.chatId, chatId))
    .orderBy(asc(chatMembers.joinedAt), asc(chatMembers.botId))

  const members: Member[] = rows.map(
    ({ id, name, job, instructions, sandboxId }) => ({
      id,
      name,
      job,
      instructions,
      sandboxId,
    })
  )
  const bot = botId ? members.find((member) => member.id === botId) : members[0]
  if (!bot) throw new Error(`Bot ${botId ?? "(any)"} is not in chat ${chatId}`)

  const [{ kind, chatName }] = rows
  return {
    bot,
    group:
      kind === "group"
        ? {
            name: chatName ?? "",
            others: members.filter((member) => member.id !== bot.id),
          }
        : null,
  }
}

function createChatTools(chatId: string, botId?: string) {
  const access = sandboxAccess(
    async () => (await loadTurn(chatId, botId)).bot.sandboxId
  )
  return {
    ...createComputerTools(access),
    ...createMemoryTool(access),
    // Offered only in group chats; see activeTools in run
    ...createHandoffTool(async (targetId) => {
      const { group } = await loadTurn(chatId, botId)
      return group?.others.find((member) => member.id === targetId) ?? null
    }),
  }
}

type ChatTools = ReturnType<typeof createChatTools>

export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  UIDataTypes,
  InferUITools<ChatTools>
>

function groupPrompt(
  { name, others }: NonNullable<Turn["group"]>,
  handedOff: boolean
) {
  const members = others
    .map((member) => `- ${member.name} (id: ${member.id}): ${member.job}`)
    .join("\n")

  return [
    `You are in a group chat${name ? ` called "${name}"` : ""} with the person and these other bots:\n\n${members}`,
    `The person picks which bot each of their messages goes to, and this one is for you. The other bots' replies appear in the conversation as assistant messages too, so not every earlier reply is yours. Each bot has its own computer: files, programs and screens you see mentioned in another bot's reply are on its computer, not yours, and that work isn't yours either.`,
    `Your tools act only on your own computer. You can't use another bot's computer or talk to the other bots directly.`,
    handedOff
      ? `Another bot handed this message to you with the handoff tool; its call, just before this turn, says why. Answer it yourself. It can't be handed on again.`
      : `If the message is clearly better suited to another bot's job, hand it off instead of answering: call the handoff tool with that bot's id and a one-sentence reason, after at most a short line telling the person who you're passing it to. Don't start the work yourself. That bot then answers the message on its own computer. When the message fits your job, or no one fits it clearly better, answer it yourself.`,
  ].join("\n\n")
}

// memory is null when it couldn't be loaded this turn
function memoryPrompt(memory: string | null, inGroup: boolean) {
  const contents =
    memory === null
      ? `Your memory couldn't be loaded this turn. Don't call save_memory until it can be, or you'd overwrite it.`
      : memory
        ? `This is your memory as it stands now:\n\n<memory>\n${memory}\n</memory>`
        : `Your memory is empty so far.`

  return [
    `You have a memory that carries over between conversations. Your conversations don't share history: your direct chat with the person and each group chat you're in show only their own messages, so what's in your memory is all you know from the others. Only you can see it.`,
    contents,
    `Rely on it: when the person asks about something that's in your memory, answer from it, even if it was said in a different conversation. Don't say you weren't told something that's in your memory.`,
    `When the person tells you something worth knowing in a later conversation, such as facts about them, their preferences, decisions, ongoing work and where it stands, or anything they ask you to remember, call save_memory in the same turn. Pass the whole memory, as a short markdown list: what's already there, updated, plus the new entries. Remove or correct entries that have changed instead of adding contradicting ones. Skip small talk and anything only useful right now. Don't announce that you saved something unless they ask.`,
    inGroup
      ? `This group chat is with the same person as your direct chat, so use your memory freely here. Save only what the person says; another bot's messages are its own and aren't facts about the person.`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

function systemPrompt(
  { bot, group }: Turn,
  handedOff: boolean,
  memory: string | null
) {
  const { name, job, instructions } = bot
  return [
    `You are ${name}, a bot whose job is: ${job}.`,
    `You were created by the person you are chatting with to do this job for them. Keep your replies focused on it, and if they ask for something outside it, say so plainly and help as far as it reasonably fits.`,
    instructions
      ? `Your creator gave you these instructions for how to go about the job:\n\n<instructions>\n${instructions}\n</instructions>`
      : null,
    group ? groupPrompt(group, handedOff) : null,
    `You have your own computer: a private, isolated Linux sandbox hosted on Daytona, created for you when you were created and deleted along with you. It has its own filesystem, network and processes, and nobody else's work runs in it. It also has a desktop you can see and operate with the mouse and keyboard.`,
    `Use your computer when the job calls for it. Prefer the shell and file tools when they can do the work, and the desktop when something needs a graphical app. Look at the screen before you click or type, and again afterwards to check the result, since screen coordinates are only valid for what is currently shown. Your screenshots are private to you; show the screen only when the person asks to see it.`,
    memoryPrompt(memory, group !== null),
    `Speak as ${name}, in the first person. Don't describe yourself as a generic AI assistant.`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// Read fresh every turn, since the bot's other chats may have changed it. A
// failure shouldn't stop the bot from answering, so it's logged and the turn
// goes on without memory
async function loadMemory(bot: Member) {
  try {
    return await readMemory(
      await sandboxAccess(async () => bot.sandboxId).sandbox()
    )
  } catch (error) {
    console.error(`Failed to load memory for bot ${bot.id}`, error)
    return null
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
      createChatTools(chatId, clientData?.botId),
    actionSchema,
    // A handoff answers the same message, so it adds no user message. The
    // action's metadata names the bot, which reaches run as clientData
    onAction: () => chat.turn(),
    // Use the run argument's streamText, not the one from "ai"; it carries the
    // prompt set below. The bot is reloaded every turn so edits to it apply
    // mid-conversation, and so each group message reaches the bot it was for
    run: async ({
      chatId,
      clientData,
      trigger,
      messages,
      tools,
      signal,
      streamText,
    }) => {
      const turn = await loadTurn(chatId, clientData?.botId)
      // One handoff per message, so two bots can't pass it back and forth
      const handedOff = trigger === "action-turn"
      const canHandOff = turn.group !== null && !handedOff

      const memory = await loadMemory(turn.bot)
      chat.prompt.set(systemPrompt(turn, handedOff, memory))
      chat.setUIMessageStreamOptions({
        messageMetadata: ({ part }) =>
          part.type === "start" ? { botId: turn.bot.id } : undefined,
      })

      return streamText({
        model: anthropic("claude-sonnet-5-5"),
        messages,
        tools,
        activeTools: canHandOff
          ? undefined
          : (Object.keys(tools).filter(
              (name) => name !== "handoff"
            ) as (keyof typeof tools)[]),
        abortSignal: signal,
        // Let the bot work through several tool calls before it replies; a
        // handoff ends its turn
        stopWhen: [isStepCount(50), hasToolCall("handoff")],
      })
    },
  })
