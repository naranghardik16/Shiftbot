import { SandboxState } from "@daytona/sdk"
import { logger, schedules } from "@trigger.dev/sdk"

import { listRunningSandboxes } from "@/lib/sandbox"
import { getAllowance, recordUsage, sandboxCostMicros } from "@/lib/usage"

// How often sandboxes are metered; matches the cron below. A sandbox found
// running is charged the whole interval, so this is the metering resolution
const INTERVAL_SECONDS = 5 * 60

// Daytona bills sandboxes for every second they run, whether or not a bot is
// using them, and they idle for up to 15 minutes before stopping themselves.
// So rather than guess from tool calls, this charges each running sandbox to
// its owner every interval, and stops the ones whose owner is out of time or
// no longer on a paid plan
export const meterSandboxes = schedules.task({
  id: "meter-sandboxes",
  cron: "*/5 * * * *",
  // A slow run must not overlap the next one and double-stop sandboxes
  queue: { concurrencyLimit: 1 },
  run: async (payload) => {
    const running = await listRunningSandboxes()
    // The scheduled time names the interval, so a retried run reuses its keys
    const tick = payload.timestamp.toISOString()

    const byUser = new Map<string, typeof running>()
    for (const sandbox of running) {
      const userId = sandbox.labels.userId
      if (!userId) continue
      byUser.set(userId, [...(byUser.get(userId) ?? []), sandbox])

      await recordUsage({
        userId,
        meter: "sandbox",
        key: `sandbox:${sandbox.id}:${tick}`,
        quantity: INTERVAL_SECONDS,
        costMicros: sandboxCostMicros(INTERVAL_SECONDS, sandbox),
        botId: sandbox.labels.botId,
      })
    }

    let stopped = 0
    for (const [userId, sandboxes] of byUser) {
      const allowance = await getAllowance(userId)
      if (allowance && allowance.remaining.sandboxSeconds > 0) continue

      for (const sandbox of sandboxes) {
        // Only a started sandbox can be stopped; the rest are caught next time
        if (sandbox.state !== SandboxState.STARTED) continue
        try {
          await sandbox.stop()
          stopped++
        } catch (error) {
          logger.error("Failed to stop sandbox over its allowance", {
            sandboxId: sandbox.id,
            error,
          })
        }
      }
    }

    logger.info("Metered sandboxes", {
      running: running.length,
      users: byUser.size,
      stopped,
    })
    return { running: running.length, users: byUser.size, stopped }
  },
})
