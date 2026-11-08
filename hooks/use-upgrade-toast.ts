"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"
import { PRICING_PATH } from "@/lib/billing"

// The only way to the pricing page: an error toast with a link to it
export function useUpgradeToast() {
  const router = useRouter()

  return useCallback(
    (description: string) =>
      toast.add({
        type: "error",
        title: "Upgrade to Pro",
        description,
        actionProps: {
          children: "See plans",
          onClick: () => router.push(PRICING_PATH),
        },
      }),
    [router]
  )
}
