import { tool } from "ai"
import { z } from "zod"

import type { SandboxAccess } from "@/lib/sandbox"

// Keep tool results small enough not to flood the model's context
const MAX_OUTPUT = 20_000

function truncate(text: string) {
  if (text.length <= MAX_OUTPUT) return text
  return `${text.slice(0, MAX_OUTPUT)}\n… [truncated ${text.length - MAX_OUTPUT} characters]`
}

// Wrap in a login shell so pipes, redirects and PATH work as in a terminal
function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

type Screenshot = { image: string; mediaType: "image/jpeg" }

// The model sees the screenshot as an image, not as base64 text
function screenshotToModel({ output }: { output: Screenshot }) {
  return {
    type: "content" as const,
    value: [
      {
        type: "file" as const,
        mediaType: output.mediaType,
        data: { type: "data" as const, data: output.image },
      },
    ],
  }
}

const coordinates = {
  x: z
    .number()
    .int()
    .min(0)
    .describe("Pixels from the left edge of the screen"),
  y: z.number().int().min(0).describe("Pixels from the top edge of the screen"),
}

const modifiers = z
  .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
  .optional()
  .describe("Modifier keys to hold during the action")

export function createComputerTools({ sandbox, desktop }: SandboxAccess) {
  async function screenshot(): Promise<Screenshot> {
    const box = await desktop()
    const shot = await box.computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 75,
      showCursor: true,
    })
    if (!shot.screenshot) throw new Error("The screenshot came back empty.")
    return { image: shot.screenshot, mediaType: "image/jpeg" }
  }

  return {
    bash: tool({
      description:
        "Run a shell command in your sandbox with bash and return its exit code and combined output. Commands start in your home directory. Long-running processes should be backgrounded with nohup and their output redirected to a file.",
      inputSchema: z.object({
        command: z.string().min(1).describe("The command to run"),
        cwd: z.string().optional().describe("Directory to run it in"),
        timeout: z
          .number()
          .int()
          .min(1)
          .max(600)
          .optional()
          .describe("Seconds before the command is killed. Defaults to 120."),
      }),
      execute: async ({ command, cwd, timeout = 120 }) => {
        const box = await sandbox()
        const response = await box.process.executeCommand(
          `bash -lc ${shellQuote(command)}`,
          cwd,
          undefined,
          timeout
        )
        return {
          exitCode: response.exitCode,
          output: truncate(response.result),
        }
      },
    }),

    read_file: tool({
      description:
        "Read a text file from your sandbox. Relative paths are resolved from your home directory.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: async ({ path }) => {
        const box = await sandbox()
        const content = await box.fs.downloadFile(path)
        return { path, content: truncate(content.toString("utf8")) }
      },
    }),

    write_file: tool({
      description:
        "Create or overwrite a text file in your sandbox. Relative paths are resolved from your home directory.",
      inputSchema: z.object({
        path: z.string().min(1),
        content: z.string().describe("The full contents of the file"),
      }),
      execute: async ({ path, content }) => {
        const box = await sandbox()
        await box.fs.uploadFile(Buffer.from(content, "utf8"), path)
        return { path, bytes: Buffer.byteLength(content, "utf8") }
      },
    }),

    list_files: tool({
      description:
        "List the files and folders in a directory of your sandbox. Relative paths are resolved from your home directory.",
      inputSchema: z.object({
        path: z.string().default(".").describe("Directory to list"),
      }),
      execute: async ({ path }) => {
        const box = await sandbox()
        const files = await box.fs.listFiles(path)
        return {
          path,
          entries: files.map((file) => ({
            name: file.name,
            type: file.isDir ? ("directory" as const) : ("file" as const),
            size: file.size,
            modifiedAt: file.modifiedAt,
          })),
        }
      },
    }),

    mouse_click: tool({
      description:
        "Click at a point on your desktop. Take a look at the screen first so you know where to click.",
      inputSchema: z.object({
        ...coordinates,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false).describe("Double-click"),
        modifiers,
      }),
      execute: async ({ x, y, button, double, modifiers }) => {
        const box = await desktop()
        await box.computerUse.mouse.click(
          x,
          y,
          button,
          double,
          undefined,
          modifiers
        )
        return { x, y, button, double }
      },
    }),

    mouse_move: tool({
      description:
        "Move the mouse pointer to a point on your desktop, e.g. to hover.",
      inputSchema: z.object(coordinates),
      execute: async ({ x, y }) => {
        const box = await desktop()
        const position = await box.computerUse.mouse.move(x, y)
        return { x: position.x ?? x, y: position.y ?? y }
      },
    }),

    mouse_drag: tool({
      description:
        "Press the mouse at one point, drag it to another and release.",
      inputSchema: z.object({
        fromX: coordinates.x,
        fromY: coordinates.y,
        toX: coordinates.x,
        toY: coordinates.y,
      }),
      execute: async ({ fromX, fromY, toX, toY }) => {
        const box = await desktop()
        await box.computerUse.mouse.drag(fromX, fromY, toX, toY)
        return { fromX, fromY, toX, toY }
      },
    }),

    mouse_scroll: tool({
      description: "Scroll the mouse wheel over a point on your desktop.",
      inputSchema: z.object({
        ...coordinates,
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(3)
          .describe("Wheel notches, each a few lines"),
      }),
      execute: async ({ x, y, direction, amount }) => {
        const box = await desktop()
        await box.computerUse.mouse.scroll(x, y, direction, amount)
        return { x, y, direction, amount }
      },
    }),

    keyboard_type: tool({
      description:
        "Type text into whatever has focus on your desktop. Newlines press Enter.",
      inputSchema: z.object({ text: z.string().min(1) }),
      execute: async ({ text }) => {
        const box = await desktop()
        await box.computerUse.keyboard.type(text)
        return { characters: text.length }
      },
    }),

    keyboard_press: tool({
      description:
        "Press a single key, optionally with modifiers, such as enter, escape, tab, backspace, arrow keys (up, down, left, right), pageup, f1-f24, or ctrl+c as key 'c' with modifiers ['ctrl'].",
      inputSchema: z.object({
        key: z.string().min(1).describe("Key name, e.g. enter or a"),
        modifiers,
      }),
      execute: async ({ key, modifiers }) => {
        const box = await desktop()
        await box.computerUse.keyboard.press(key, modifiers)
        return { key, modifiers: modifiers ?? [] }
      },
    }),

    view_screen: tool({
      description:
        "Take a screenshot of your desktop for yourself, to see what's on it before or after acting. The person you're chatting with does not see it. Use show_screen instead when they ask to see the screen.",
      inputSchema: z.object({}),
      execute: screenshot,
      toModelOutput: screenshotToModel,
    }),

    show_screen: tool({
      description:
        "Take a screenshot of your desktop and show it to the person you're chatting with. Use this when they ask what's on your screen or want to see it.",
      inputSchema: z.object({}),
      execute: screenshot,
      toModelOutput: screenshotToModel,
    }),
  }
}

export type ComputerTools = ReturnType<typeof createComputerTools>

// Another member of the group chat, or null if the id isn't one
type FindOtherMember = (
  botId: string
) => Promise<{ id: string; name: string } | null>

// Group chats only. The bot's turn ends on this call, and the browser then
// asks the chosen bot to answer the same message in a reply of its own
export function createHandoffTool(findOtherMember: FindOtherMember) {
  return {
    handoff: tool({
      description:
        "Hand the person's latest message to another bot in this group chat whose job fits it clearly better. That bot answers it next, in its own reply and on its own computer. Your turn ends when you call this, so don't start the work yourself.",
      inputSchema: z.object({
        botId: z
          .string()
          .describe("The id of the bot to hand off to, from the member list"),
        reason: z
          .string()
          .describe(
            "In a sentence, why that bot fits better. The person and that bot both see it"
          ),
      }),
      execute: async ({ botId }) => {
        const bot = await findOtherMember(botId)
        if (!bot) {
          throw new Error(`No other bot in this group chat has the id ${botId}`)
        }
        return { botId: bot.id, name: bot.name }
      },
    }),
  }
}

export type HandoffTools = ReturnType<typeof createHandoffTool>
