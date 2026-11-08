"use client"

import { useChat } from "@ai-sdk/react"
import { useAuth } from "@clerk/nextjs"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import type { BundledLanguage } from "shiki"

import {
  checkChatAllowance,
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import { CodeBlock } from "@/components/ai-elements/code-block"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { useStickToBottomContext } from "use-stick-to-bottom"
import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { Terminal } from "@/components/ai-elements/terminal"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useBillingToast } from "@/hooks/use-billing-toast"
import { BOT_FEATURES, hasFeatures, parseBillingError } from "@/lib/billing"
import type { ChatUIMessage, chatAgent } from "@/trigger/chat"

type Transport = ReturnType<typeof useTriggerChatTransport<typeof chatAgent>>
type ToolPart = Extract<
  ChatUIMessage["parts"][number],
  { type: `tool-${string}` }
>

// A member of the chat; direct chats have one, group chats several
type ChatBot = { id: string; name: string; avatar: string }

export function Chat({ id, bots }: { id: string; bots: ChatBot[] }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  })
  // Seeds the transport's resume cursor so the stream picks up after history
  const { messages, isLoading } = useLoadTranscript(id, loadChatTranscript, {
    transport,
  })

  // useChat must mount with the loaded history, so wait for it
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <ChatView
      id={id}
      bots={bots}
      transport={transport}
      initialMessages={messages as ChatUIMessage[]}
    />
  )
}

function ChatView({
  id,
  bots,
  transport,
  initialMessages,
}: {
  id: string
  bots: ChatBot[]
  transport: Transport
  initialMessages: ChatUIMessage[]
}) {
  const [text, setText] = useState("")
  // The bot the next message goes to; only group chats offer a choice
  const [pickedId, setPickedId] = useState(bots[0].id)
  // The picked bot may have been removed from the group since
  const botId = bots.some((bot) => bot.id === pickedId) ? pickedId : bots[0].id
  const isGroup = bots.length > 1
  const { messages, status, error, sendMessage, stop } = useChat<ChatUIMessage>(
    {
      id,
      transport,
      messages: initialMessages,
    }
  )
  // The server refuses a session to free plans; checking here first lets the
  // person see why instead of a failed send
  const { has } = useAuth()
  const canChat = hasFeatures(has, BOT_FEATURES)
  const showBillingToast = useBillingToast()
  // While the allowance check for a new message is in flight
  const [checking, setChecking] = useState(false)

  // The agent refuses a turn when the allowance has run out in the meantime,
  // for example during a handoff or in another tab
  useEffect(() => {
    const block = error && parseBillingError(error.message)
    if (block) showBillingToast(block.billing, block.error)
  }, [error, showBillingToast])

  // When a reply ends in a handoff, ask the chosen bot to answer the same
  // message. Also picks up a handoff left pending by a closed tab
  const handedOff = useRef(new Set<string>())
  useEffect(() => {
    if (status !== "ready") return
    const last = messages.at(-1)
    if (last?.role !== "assistant" || handedOff.current.has(last.id)) return
    const handoff = last.parts.findLast((part) => part.type === "tool-handoff")
    if (handoff?.state !== "output-available") return
    // Left for later, so the handoff goes through once the plan allows it
    if (!canChat) return

    handedOff.current.add(last.id)
    // The action's metadata reaches the agent as that turn's clientData
    sendMessage(undefined, {
      body: { action: { type: "handoff" } },
      metadata: { botId: handoff.output.botId },
    })
  }, [status, messages, sendMessage, canChat])

  async function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim() || checking) return
    if (!canChat) {
      showBillingToast("upgrade", "Chatting with bots is part of the Pro plan.")
      return
    }
    // Ask first, so a used-up allowance shows a toast and keeps the draft,
    // rather than leaving the message unanswered in the chat
    setChecking(true)
    const allowance = await checkChatAllowance().finally(() =>
      setChecking(false)
    )
    if (!allowance.ok) {
      showBillingToast(allowance.billing, allowance.error)
      return
    }
    // The request metadata reaches the agent as this turn's clientData; the
    // message's own metadata is saved with it, so it can show who it was for
    sendMessage(
      { text: message.text, metadata: { botId } },
      { metadata: { botId } }
    )
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState description="Send a message to start chatting" />
          ) : (
            messages.map((message) => {
              // In group chats, a message starts with the bot it was sent to
              const recipient =
                isGroup && message.role === "user"
                  ? bots.find((bot) => bot.id === message.metadata?.botId)
                  : undefined

              const parts = message.parts.map((part, i) => {
                const key = `${message.id}-${i}`
                if (part.type === "text") {
                  return (
                    <MessageResponse key={key}>{part.text}</MessageResponse>
                  )
                }
                if (part.type.startsWith("tool-")) {
                  return <ToolCall key={key} part={part as ToolPart} />
                }
                return null
              })

              const content = (
                // Long words like URLs and paths wrap instead of being cut off
                <MessageContent className="wrap-break-word">
                  {recipient ? (
                    // A block wrapper, since floats don't flow in the flex
                    // column: the tag sits on the text's first line, like a
                    // mention, and the rest of the text wraps around it
                    <div>
                      <Badge
                        variant="outline"
                        className="float-left me-1.5 max-w-40 gap-1 pl-1"
                      >
                        <ChatAvatar
                          seed={recipient.avatar}
                          className="size-3.5"
                        />
                        <span className="truncate">{recipient.name}</span>
                      </Badge>
                      {parts}
                    </div>
                  ) : (
                    parts
                  )}
                </MessageContent>
              )

              // In group chats, a reply sits beside the face of the bot that
              // wrote it; older replies may name a bot that has since left
              const bot =
                isGroup && message.role === "assistant"
                  ? bots.find((bot) => bot.id === message.metadata?.botId)
                  : undefined
              if (!bot) {
                return (
                  <Message from={message.role} key={message.id}>
                    {content}
                  </Message>
                )
              }

              return (
                <Message
                  from={message.role}
                  key={message.id}
                  className="flex-row items-start gap-3"
                >
                  <ChatAvatar seed={bot.avatar} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium">{bot.name}</span>
                    {content}
                  </div>
                </Message>
              )
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
        <StayAtBottomOnResize />
      </Conversation>

      {/* Clear of the home indicator on phones */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              // A long draft scrolls inside the box rather than pushing the
              // send button off a short screen, like a landscape phone with
              // the keyboard open
              className="max-h-[min(12rem,30dvh)]"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </PromptInputBody>
          <PromptInputFooter className={isGroup ? undefined : "justify-end"}>
            {isGroup && (
              <PromptInputSelect
                value={botId}
                onValueChange={(value) =>
                  typeof value === "string" && setPickedId(value)
                }
              >
                <PromptInputSelectTrigger aria-label="Bot to talk to">
                  <PromptInputSelectValue>
                    {(value: string) => (
                      <BotLabel bot={bots.find((bot) => bot.id === value)} />
                    )}
                  </PromptInputSelectValue>
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {bots.map((bot) => (
                    <PromptInputSelectItem key={bot.id} value={bot.id}>
                      <BotLabel bot={bot} />
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            )}
            <PromptInputSubmit
              disabled={(!text.trim() && status === "ready") || checking}
              status={status}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

// The list only follows its content's size, so when the on-screen keyboard
// opens or the phone rotates, the shorter view would leave the latest message
// hidden. Keep it in view if it was before the resize
function StayAtBottomOnResize() {
  const { scrollRef, isAtBottom, scrollToBottom } = useStickToBottomContext()
  const wasAtBottom = useRef(isAtBottom)
  useEffect(() => {
    wasAtBottom.current = isAtBottom
  }, [isAtBottom])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    let height = scroller.clientHeight
    const observer = new ResizeObserver(() => {
      const shrank = scroller.clientHeight < height
      height = scroller.clientHeight
      if (shrank && wasAtBottom.current) scrollToBottom("instant")
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [scrollRef, scrollToBottom])

  return null
}

function BotLabel({ bot }: { bot?: ChatBot }) {
  if (!bot) return null
  return (
    <>
      <ChatAvatar seed={bot.avatar} className="size-4" />
      {bot.name}
    </>
  )
}

// A collapsible row for one tool call; rows without details don't expand
function ToolRow({
  part,
  title,
  children,
}: {
  part: ToolPart
  title: string
  children?: ReactNode
}) {
  const failed = part.state === "output-error"
  return (
    <Tool>
      <ToolHeader type={part.type} state={part.state} title={title} />
      {(children || failed) && (
        <ToolContent>
          {children}
          {failed && (
            <ToolOutput output={undefined} errorText={part.errorText} />
          )}
        </ToolContent>
      )}
    </Tool>
  )
}

function ToolCall({ part }: { part: ToolPart }) {
  const done = part.state === "output-available"

  switch (part.type) {
    case "tool-bash": {
      const command = part.input?.command ?? ""
      const output = done
        ? `$ ${command}\n${part.output.output}${
            part.output.exitCode === 0 ? "" : `\n[exit ${part.output.exitCode}]`
          }`
        : `$ ${command}`
      return (
        <ToolRow part={part} title={`Ran ${truncate(command, 60)}`}>
          <Terminal
            output={output}
            isStreaming={!done && part.state !== "output-error"}
          />
        </ToolRow>
      )
    }

    case "tool-read_file": {
      const path = part.input?.path ?? ""
      return (
        <ToolRow part={part} title={`Read ${path}`}>
          {done && (
            <CodeBlock code={part.output.content} language={languageOf(path)} />
          )}
        </ToolRow>
      )
    }

    case "tool-write_file": {
      const path = part.input?.path ?? ""
      return (
        <ToolRow part={part} title={`Wrote ${path}`}>
          {part.input?.content !== undefined && (
            <CodeBlock code={part.input.content} language={languageOf(path)} />
          )}
        </ToolRow>
      )
    }

    case "tool-list_files": {
      const path = part.input?.path ?? "."
      return (
        <ToolRow part={part} title={`Listed ${path}`}>
          {done && (
            <FileTree>
              {part.output.entries.map((entry) =>
                entry.type === "directory" ? (
                  <FileTreeFolder
                    key={entry.name}
                    path={`${path}/${entry.name}`}
                    name={entry.name}
                  />
                ) : (
                  <FileTreeFile
                    key={entry.name}
                    path={`${path}/${entry.name}`}
                    name={entry.name}
                  />
                )
              )}
            </FileTree>
          )}
        </ToolRow>
      )
    }

    case "tool-mouse_click": {
      const { x, y, button, double } = part.input ?? {}
      const kind = `${double ? "Double-clicked" : "Clicked"}${
        button && button !== "left" ? ` ${button}` : ""
      }`
      return (
        <ToolRow part={part} title={`${kind} at ${x ?? "…"}, ${y ?? "…"}`} />
      )
    }

    case "tool-mouse_move":
      return (
        <ToolRow
          part={part}
          title={`Moved the mouse to ${part.input?.x ?? "…"}, ${part.input?.y ?? "…"}`}
        />
      )

    case "tool-mouse_drag":
      return (
        <ToolRow
          part={part}
          title={`Dragged from ${part.input?.fromX ?? "…"}, ${part.input?.fromY ?? "…"} to ${part.input?.toX ?? "…"}, ${part.input?.toY ?? "…"}`}
        />
      )

    case "tool-mouse_scroll":
      return (
        <ToolRow
          part={part}
          title={`Scrolled ${part.input?.direction ?? ""}`}
        />
      )

    case "tool-keyboard_type":
      return (
        <ToolRow
          part={part}
          title={`Typed "${truncate(part.input?.text ?? "", 40)}"`}
        />
      )

    case "tool-keyboard_press": {
      const keys = [...(part.input?.modifiers ?? []), part.input?.key ?? ""]
      return <ToolRow part={part} title={`Pressed ${keys.join("+")}`} />
    }

    case "tool-save_memory":
      return (
        <ToolRow
          part={part}
          title={done ? "Updated memory" : "Updating memory"}
        >
          {part.input?.content !== undefined && (
            <CodeBlock code={part.input.content} language="markdown" />
          )}
        </ToolRow>
      )

    case "tool-handoff":
      return (
        <ToolRow
          part={part}
          title={done ? `Handed off to ${part.output.name}` : "Handing off"}
        >
          {part.input?.reason && (
            <p className="text-sm text-muted-foreground">{part.input.reason}</p>
          )}
        </ToolRow>
      )

    // The bot's own look at the screen; the image stays out of the chat
    case "tool-view_screen":
      return <ToolRow part={part} title="Looked at the screen" />

    // Shown because the person asked to see the screen
    case "tool-show_screen":
      if (!done) return <ToolRow part={part} title="Taking a screenshot" />
      return (
        <Image
          base64={part.output.image}
          mediaType={part.output.mediaType}
          uint8Array={new Uint8Array()}
          alt="The bot's screen"
          className="border"
        />
      )

    default:
      return null
  }
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}…` : text
}

const languages: Record<string, BundledLanguage> = {
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  py: "python",
  sh: "bash",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
}

// CodeBlock falls back to plain text for languages it doesn't know
function languageOf(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  return languages[extension] ?? ("text" as BundledLanguage)
}
