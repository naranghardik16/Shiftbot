"use client"

import { useChat } from "@ai-sdk/react"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import type { ReactNode } from "react"
import { useState } from "react"
import type { BundledLanguage } from "shiki"

import {
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
import { Spinner } from "@/components/ui/spinner"
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
  const [botId, setBotId] = useState(bots[0].id)
  const isGroup = bots.length > 1
  const { messages, status, sendMessage, stop } = useChat<ChatUIMessage>({
    id,
    transport,
    messages: initialMessages,
  })

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) return
    // Per-message metadata reaches the agent as this turn's clientData
    sendMessage({ text: message.text }, { metadata: { botId } })
    setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState description="Send a message to start chatting" />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                {isGroup && message.role === "assistant" && (
                  <BotByline
                    bot={bots.find((bot) => bot.id === message.metadata?.botId)}
                  />
                )}
                <MessageContent>
                  {message.parts.map((part, i) => {
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
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </PromptInputBody>
          <PromptInputFooter className={isGroup ? undefined : "justify-end"}>
            {isGroup && (
              <PromptInputSelect
                value={botId}
                onValueChange={(value) =>
                  typeof value === "string" && setBotId(value)
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
              disabled={!text.trim() && status === "ready"}
              status={status}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
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

// Who wrote a reply in a group chat; older replies may name a bot that left
function BotByline({ bot }: { bot?: ChatBot }) {
  if (!bot) return null
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <ChatAvatar seed={bot.avatar} className="size-5" />
      {bot.name}
    </div>
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
