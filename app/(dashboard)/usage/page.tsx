import { auth } from "@clerk/nextjs/server"
import { format } from "date-fns"
import {
  BotIcon,
  GaugeIcon,
  SparklesIcon,
  TerminalSquareIcon,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { MobileHeader } from "@/components/mobile-header"
import { ResetCountdown } from "@/components/reset-countdown"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { PRICING_PATH } from "@/lib/billing"
import { getAllowance } from "@/lib/usage"

const compact = new Intl.NumberFormat("en", { notation: "compact" })

function hours(seconds: number) {
  const value = seconds / 3600
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} h`
}

// Used share of a limit, as a whole percentage between 0 and 100
function percent(used: number, limit: number) {
  return Math.min(100, Math.round((used / limit) * 100))
}

function Meter({
  icon,
  label,
  used,
  limit,
  detail,
}: {
  icon: ReactNode
  label: string
  used: number
  limit: number
  detail: string
}) {
  const value = percent(used, limit)
  return (
    <Progress value={value} className="gap-2">
      <ProgressLabel className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {label}
      </ProgressLabel>
      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
        {detail}
      </span>
    </Progress>
  )
}

export default async function Page() {
  const { userId } = await auth.protect()
  const allowance = await getAllowance(userId)

  if (!allowance) {
    return (
      <div className="flex min-h-dvh flex-col">
        <MobileHeader />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>No usage allowance</EmptyTitle>
            <EmptyDescription>
              The free plan doesn&apos;t include bots or sandboxes. Upgrade to
              Pro to get a monthly allowance.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href={PRICING_PATH} />}>See plans</Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const { period, usage, bots } = allowance
  const { limits } = period

  return (
    <div className="flex min-h-dvh flex-col">
      <MobileHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-6 md:py-16">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-muted-foreground">
            What you&apos;ve used of your Pro allowance this billing period.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Resets in <ResetCountdown resetsAt={period.end.toISOString()} />
            </CardTitle>
            <CardDescription>
              Current period: {format(period.start, "MMM d")} –{" "}
              {format(period.end, "MMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Meter
              icon={<SparklesIcon />}
              label="AI usage"
              used={usage.ai.costMicros}
              limit={limits.aiMicros}
              detail={`${percent(usage.ai.costMicros, limits.aiMicros)}% · ${compact.format(usage.ai.quantity)} tokens`}
            />
            <Meter
              icon={<TerminalSquareIcon />}
              label="Sandbox time"
              used={usage.sandbox.quantity}
              limit={limits.sandboxSeconds}
              detail={`${hours(usage.sandbox.quantity)} of ${hours(limits.sandboxSeconds)}`}
            />
            <Meter
              icon={<BotIcon />}
              label="Bots"
              used={bots}
              limit={limits.bots}
              detail={`${bots} of ${limits.bots}`}
            />
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          AI usage counts every message your bots read and write. Sandbox time
          counts while a bot&apos;s computer is running, including the few idle
          minutes before it switches itself off. When AI usage runs out, bots
          stop replying until the period resets; when sandbox time runs out,
          their computers switch off but they can still chat.
        </p>
      </div>
    </div>
  )
}
