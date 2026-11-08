import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

export default async function Page() {
  await auth.protect()

  return (
    <div className="flex min-h-svh flex-col items-center gap-8 px-6 py-16">
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pick your plan
        </h1>
        <p className="text-muted-foreground">
          Pro unlocks everything: create bots, chat with them, and give each
          one its own computer you can watch and control.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <PricingTable highlightedPlan="pro" newSubscriptionRedirectUrl="/" />
      </div>
    </div>
  )
}
