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

// Failure shape for actions a free user can't take; the client shows the
// upgrade toast when it sees upgradeRequired
export function upgradeRequired(error: string) {
  return { ok: false as const, error, upgradeRequired: true as const }
}
