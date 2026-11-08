// Feature slugs from Clerk Billing (Dashboard → Billing → Plans). The Pro plan
// carries both; the free plan carries neither
export type BillableFeature = "bots" | "sandboxes"

// Every bot owns a sandbox, and a chat turn can use it, so creating a bot and
// chatting with one need both
export const BOT_FEATURES: BillableFeature[] = ["bots", "sandboxes"]
export const SANDBOX_FEATURES: BillableFeature[] = ["sandboxes"]

type Has = (params: { feature: BillableFeature }) => boolean

export function hasFeatures(has: Has | undefined, features: BillableFeature[]) {
  return !!has && features.every((feature) => has({ feature }))
}

export const PRICING_PATH = "/pricing"
export const USAGE_PATH = "/usage"

// Why an action was refused: the free plan doesn't include it, or the paid
// plan's allowance for this period is used up
export type BillingBlock = "upgrade" | "limit"

// Failure shape for billing refusals; the client shows the matching toast
export type BillingFailure = {
  ok: false
  error: string
  billing: BillingBlock
}

export function upgradeRequired(error: string): BillingFailure {
  return { ok: false, error, billing: "upgrade" }
}

export function limitReached(error: string): BillingFailure {
  return { ok: false, error, billing: "limit" }
}

// The agent's turn errors reach the browser as plain text, so billing
// refusals carry a prefix the browser can recognize
const ERROR_PREFIX: Record<BillingBlock, string> = {
  upgrade: "UPGRADE_REQUIRED: ",
  limit: "USAGE_LIMIT: ",
}

export function billingErrorText(billing: BillingBlock, error: string) {
  return `${ERROR_PREFIX[billing]}${error}`
}

// The block and the readable message, or null for any other error
export function parseBillingError(
  text: string
): { billing: BillingBlock; error: string } | null {
  for (const [billing, prefix] of Object.entries(ERROR_PREFIX)) {
    if (text.startsWith(prefix)) {
      return {
        billing: billing as BillingBlock,
        error: text.slice(prefix.length),
      }
    }
  }
  return null
}
