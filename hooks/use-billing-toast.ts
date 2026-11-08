"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"
import { PRICING_PATH, USAGE_PATH, type BillingBlock } from "@/lib/billing"

const toasts: Record<
  BillingBlock,
  { title: string; action: string; href: string }
> = {
  // The only way to the pricing page
  upgrade: { title: "Upgrade to Pro", action: "See plans", href: PRICING_PATH },
  limit: {
    title: "Usage limit reached",
    action: "See usage",
    href: USAGE_PATH,
  },
}

// An error toast that links to where the person can fix the block
export function useBillingToast() {
  const router = useRouter()

  return useCallback(
    (billing: BillingBlock, description: string) => {
      const { title, action, href } = toasts[billing]
      toast.add({
        type: "error",
        title,
        description,
        actionProps: { children: action, onClick: () => router.push(href) },
      })
    },
    [router]
  )
}
