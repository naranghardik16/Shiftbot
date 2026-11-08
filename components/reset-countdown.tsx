"use client"

import { formatDistanceStrict } from "date-fns"
import { useSyncExternalStore } from "react"

const MINUTE = 60_000

// The current time, rounded to the minute, as a store the page re-renders on
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE)
  return () => clearInterval(id)
}
function currentMinute() {
  return Math.floor(Date.now() / MINUTE) * MINUTE
}

// Time left until the allowance resets, kept current while the page is open
export function ResetCountdown({ resetsAt }: { resetsAt: string }) {
  const now = useSyncExternalStore(subscribe, currentMinute, currentMinute)
  const end = new Date(resetsAt)

  return (
    // Relative to now, so server and client can differ
    <time dateTime={resetsAt} suppressHydrationWarning>
      {end.getTime() > now ? formatDistanceStrict(end, now) : "now"}
    </time>
  )
}
