import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { and, count, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/db"
import { bots, usageEvents, type UsageMeter } from "@/db/schema"

// Shared by the Next.js server and the Trigger.dev worker, so it talks to
// Clerk through @clerk/backend rather than @clerk/nextjs

// What each paid plan allows per billing period. Keyed by Clerk plan slug
export const PLAN_LIMITS = {
  pro: {
    // Model spend we cover, in millionths of a dollar
    aiMicros: 8_000_000,
    // Time sandboxes may spend running, in seconds
    sandboxSeconds: 30 * 60 * 60,
    // Bots alive at once; each one keeps a sandbox's disk around
    bots: 5,
  },
} as const

type PlanSlug = keyof typeof PLAN_LIMITS
export type PlanLimits = (typeof PLAN_LIMITS)[PlanSlug]

// Anthropic list prices for the chat model, in millionths of a dollar per
// token. Cache writes are the 5-minute kind, at 1.25x input
const MODEL_PRICES = {
  input: 2,
  output: 10,
  cacheRead: 0.2,
  cacheWrite: 2.5,
}

// Daytona list prices, in dollars per hour. Billed per second while running
const SANDBOX_PRICES = { vcpuHour: 0.0504, memoryGibHour: 0.0162 }

export function modelCostMicros(usage: LanguageModelUsage) {
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0
  const uncached =
    usage.inputTokenDetails.noCacheTokens ??
    Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite)
  const output = usage.outputTokens ?? 0
  return Math.ceil(
    uncached * MODEL_PRICES.input +
      cacheRead * MODEL_PRICES.cacheRead +
      cacheWrite * MODEL_PRICES.cacheWrite +
      output * MODEL_PRICES.output
  )
}

export function modelTokens(usage: LanguageModelUsage) {
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
}

export function sandboxCostMicros(
  seconds: number,
  { cpu, memory }: { cpu: number; memory: number }
) {
  const perHour =
    cpu * SANDBOX_PRICES.vcpuHour + memory * SANDBOX_PRICES.memoryGibHour
  return Math.ceil((seconds / 3600) * perHour * 1_000_000)
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

export type BillingPeriod = {
  plan: PlanSlug
  limits: PlanLimits
  start: Date
  end: Date
}

// Clerk is asked at most once a minute per user and process
const PERIOD_CACHE_MS = 60_000
const periodCache = new Map<
  string,
  { period: BillingPeriod | null; expires: number }
>()

// The user's current paid billing period, from their Clerk subscription. Null
// on the free plan, which has no allowance
export async function getBillingPeriod(
  userId: string
): Promise<BillingPeriod | null> {
  const cached = periodCache.get(userId)
  if (cached && cached.expires > Date.now()) return cached.period

  let period: BillingPeriod | null = null
  try {
    const subscription = await clerk.billing.getUserBillingSubscription(userId)
    const item = subscription.subscriptionItems.find(
      (item) =>
        item.status === "active" &&
        item.plan?.slug !== undefined &&
        item.plan.slug in PLAN_LIMITS
    )
    if (item?.plan) {
      const plan = item.plan.slug as PlanSlug
      const start = new Date(item.periodStart)
      // Paid recurring items always end; a month is the fallback if one doesn't
      const end = item.periodEnd
        ? new Date(item.periodEnd)
        : new Date(new Date(start).setMonth(start.getMonth() + 1))
      period = { plan, limits: PLAN_LIMITS[plan], start, end }
    }
  } catch (error) {
    // No subscription at all reads as the free plan
    if ((error as { status?: number }).status !== 404) throw error
  }

  periodCache.set(userId, { period, expires: Date.now() + PERIOD_CACHE_MS })
  return period
}

export type Usage = Record<UsageMeter, { quantity: number; costMicros: number }>

// Totals from the ledger for the period
async function sumUsage(userId: string, period: BillingPeriod): Promise<Usage> {
  const rows = await db
    .select({
      meter: usageEvents.meter,
      quantity: sql<string>`coalesce(sum(${usageEvents.quantity}), 0)`,
      costMicros: sql<string>`coalesce(sum(${usageEvents.costMicros}), 0)`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        gte(usageEvents.createdAt, period.start),
        lt(usageEvents.createdAt, period.end)
      )
    )
    .groupBy(usageEvents.meter)

  const usage: Usage = {
    ai: { quantity: 0, costMicros: 0 },
    sandbox: { quantity: 0, costMicros: 0 },
  }
  for (const row of rows) {
    usage[row.meter] = {
      quantity: Number(row.quantity),
      costMicros: Number(row.costMicros),
    }
  }
  return usage
}

export type Allowance = {
  period: BillingPeriod
  usage: Usage
  bots: number
  // What's left this period; never below zero
  remaining: { aiMicros: number; sandboxSeconds: number; bots: number }
}

// The user's allowance and what they've used of it. Null on the free plan
export async function getAllowance(userId: string): Promise<Allowance | null> {
  const period = await getBillingPeriod(userId)
  if (!period) return null

  const [usage, [{ bots: botCount }]] = await Promise.all([
    sumUsage(userId, period),
    db.select({ bots: count() }).from(bots).where(eq(bots.userId, userId)),
  ])

  const { limits } = period
  return {
    period,
    usage,
    bots: botCount,
    remaining: {
      aiMicros: Math.max(0, limits.aiMicros - usage.ai.costMicros),
      sandboxSeconds: Math.max(
        0,
        limits.sandboxSeconds - usage.sandbox.quantity
      ),
      bots: Math.max(0, limits.bots - botCount),
    },
  }
}

// Writes one ledger row; a repeated key is ignored
export async function recordUsage(event: {
  userId: string
  meter: UsageMeter
  key: string
  quantity: number
  costMicros: number
  botId?: string
}) {
  await db.insert(usageEvents).values(event).onConflictDoNothing({
    target: usageEvents.key,
  })
}
