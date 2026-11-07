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

// One sandbox per bot; labels tie it back to the bot in the Daytona dashboard
export async function createBotSandbox(botId: string, userId: string) {
  const sandbox = await daytona.create({
    labels: { app: "shiftbot", botId, userId },
  })
  return sandbox.id
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
export function sandboxAccess(getSandboxId: () => Promise<string>): SandboxAccess {
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
