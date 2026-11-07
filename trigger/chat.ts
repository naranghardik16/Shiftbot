import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"

// One durable run per chat; history is kept in the platform's transcript
// storage, keyed by chat id
export const chatAgent = chat.agent({
  id: "chat",
  // Use the run argument's streamText, not the one from "ai"
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      abortSignal: signal,
    }),
})
