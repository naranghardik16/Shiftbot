import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

// Where each item sits inside the square, by item count: two side by side and
// overlapping, three in a triangle, four in a 2x2 grid
const layouts: Record<number, string[]> = {
  1: ["inset-0 size-full"],
  2: [
    "top-1/2 left-0 size-3/5 -translate-y-1/2",
    "top-1/2 right-0 size-3/5 -translate-y-1/2",
  ],
  3: [
    "top-0 left-1/2 size-[55%] -translate-x-1/2",
    "bottom-0 left-0 size-[55%]",
    "bottom-0 right-0 size-[55%]",
  ],
  4: [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "bottom-0 right-0 size-1/2",
  ],
}

const MAX_FACES = 3

// The members' faces packed into the footprint of a single ChatAvatar, so it
// can stand in for one at any size. Past three bots, a fourth slot counts the
// rest
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  const faces = seeds.slice(0, MAX_FACES)
  const hidden = seeds.length - faces.length
  const slots = layouts[faces.length + (hidden > 0 ? 1 : 0)] ?? []

  return (
    <div
      data-slot="group-chat-avatar"
      className={cn("@container relative size-8 shrink-0", className)}
    >
      {faces.map((seed, i) => (
        <ChatAvatar
          key={`${seed}-${i}`}
          seed={seed}
          className={cn("absolute", slots[i])}
        />
      ))}
      {hidden > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[30cqw] leading-none font-medium tracking-tighter text-muted-foreground",
            slots[faces.length]
          )}
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
