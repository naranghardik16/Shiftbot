import {
  Daytona,
  DaytonaNotFoundError,
  SandboxState,
  type Sandbox,
} from "@daytona/sdk"

// Reads DAYTONA_API_KEY from the environment. Leave DAYTONA_API_URL unset in
// .env files: the SDK refuses an endpoint it finds there
const globalForDaytona = globalThis as unknown as { daytona?: Daytona }
const daytona = globalForDaytona.daytona ?? new Daytona()
if (process.env.NODE_ENV !== "production") globalForDaytona.daytona = daytona

// The bot's long-term memory, in its home directory. The sandbox belongs to
// the bot, not to a chat, so every chat the bot is in sees the same file
export const MEMORY_FILE = "MEMORY.md"

async function memoryPath(sandbox: Sandbox) {
  const home = await sandbox.getUserHomeDir()
  return home ? `${home}/${MEMORY_FILE}` : MEMORY_FILE
}

// Empty when the file doesn't exist yet
export async function readMemory(sandbox: Sandbox) {
  const response = await sandbox.process.executeCommand(
    `cat "${await memoryPath(sandbox)}" 2>/dev/null || true`
  )
  return response.result.trim()
}

export async function writeMemory(sandbox: Sandbox, content: string) {
  await sandbox.fs.uploadFile(
    Buffer.from(content, "utf8"),
    await memoryPath(sandbox)
  )
}

// One sandbox per bot; labels tie it back to the bot in the Daytona dashboard
export async function createBotSandbox(botId: string, userId: string) {
  const sandbox = await daytona.create({
    labels: { app: "shiftbot", botId, userId },
  })
  try {
    await writeMemory(sandbox, "")
  } catch (error) {
    // A bot without its memory file isn't set up; don't leave the sandbox behind
    await daytona
      .delete(sandbox)
      .catch((cleanupError) =>
        console.error("Failed to delete half-set-up sandbox", cleanupError)
      )
    throw error
  }
  return sandbox.id
}

// States Daytona bills CPU and memory for; a stopped sandbox pays for disk only
const RUNNING_STATES = [
  SandboxState.CREATING,
  SandboxState.STARTING,
  SandboxState.STARTED,
  SandboxState.STOPPING,
  SandboxState.RESTORING,
  SandboxState.RESIZING,
]

// Every bot sandbox that is running right now, across all users
export async function listRunningSandboxes() {
  const running: Sandbox[] = []
  for await (const sandbox of daytona.list({
    labels: { app: "shiftbot" },
    states: RUNNING_STATES,
  })) {
    running.push(sandbox)
  }
  return running
}

export async function deleteBotSandbox(sandboxId: string) {
  try {
    const sandbox = await daytona.get(sandboxId)
    await daytona.delete(sandbox)
  } catch (error) {
    // Already gone is the outcome we wanted
    if (error instanceof DaytonaNotFoundError) return
    throw error
  }
}

// noVNC serves the desktop's web viewer on this port
const NOVNC_PORT = 6080
const DESKTOP_URL_TTL_SECONDS = 60 * 60

// A browser-openable noVNC viewer for the sandbox's desktop. The signed URL is
// bound to the noVNC port and expires, so it is safe to hand to the client
export async function getSandboxDesktopUrl(sandboxId: string) {
  const box = await sandboxAccess(async () => sandboxId).desktop()
  const { url } = await box.getSignedPreviewUrl(
    NOVNC_PORT,
    DESKTOP_URL_TTL_SECONDS
  )
  const viewer = new URL("/vnc.html", url)
  viewer.searchParams.set("autoconnect", "true")
  viewer.searchParams.set("reconnect", "true")
  // Scale the desktop to fit whatever box the viewer is shown in
  viewer.searchParams.set("resize", "scale")
  return viewer.toString()
}

export type SandboxAccess = {
  // The sandbox, started if it had stopped
  sandbox: () => Promise<Sandbox>
  // The sandbox with its desktop running, for mouse, keyboard and screen use
  desktop: () => Promise<Sandbox>
}

// Retries on the next call if the first attempt failed
function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    pending ??= fn().catch((error) => {
      pending = undefined
      throw error
    })
    return pending
  }
}

// Nothing touches the sandbox until a tool asks for it, so chats that never use
// it don't wake it up
export function sandboxAccess(
  getSandboxId: () => Promise<string>
): SandboxAccess {
  const sandbox = once(async () => {
    const box = await daytona.get(await getSandboxId())
    // Sandboxes auto-stop when idle; start covers stopped and archived ones
    if (box.state !== SandboxState.STARTED) await box.start()
    return box
  })

  const desktop = once(async () => {
    const box = await sandbox()
    const { status } = await box.computerUse.getStatus()
    if (status !== "active") await box.computerUse.start()
    return box
  })

  return { sandbox, desktop }
}
