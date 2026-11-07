// pg v8 silently upgrades sslmode=require to verify-full; pg v9 will not.
// Demand verify-full explicitly so the certificate check can never quietly weaken.
export function assertVerifyFull(name: string, url: string) {
  const mode = new URL(url).searchParams.get("sslmode")
  if (mode !== "verify-full") {
    throw new Error(
      `${name} must use sslmode=verify-full (got ${mode ?? "none"})`
    )
  }
}
