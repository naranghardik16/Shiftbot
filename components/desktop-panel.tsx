"use client"

import { MonitorIcon, RefreshCwIcon } from "lucide-react"
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { usePanelRef, type PanelImperativeHandle } from "react-resizable-panels"
import { cn } from "cn"

import { getBotDesktop } from "@/actions/bot"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ResizablePanel } from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useBillingToast } from "@/hooks/use-billing-toast"

// Daytona desktops run at 1024x768 unless the sandbox sets VNC_RESOLUTION
const DESKTOP_RATIO = 4 / 3

type Desktop =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string }

type DesktopPanelContextValue = {
  panelRef: RefObject<PanelImperativeHandle | null>
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  desktop: Desktop
  connect: () => void
  connecting: boolean
  fullscreen: boolean
  setFullscreen: (fullscreen: boolean) => void
  // Where the viewer is drawn: the preview in the panel or the dialog body
  setPanelSlot: (element: HTMLElement | null) => void
  setDialogSlot: (element: HTMLElement | null) => void
}

const DesktopPanelContext = createContext<DesktopPanelContextValue | null>(
  null
)

function useDesktopPanel() {
  const context = use(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider")
  }
  return context
}

export function DesktopPanelProvider({
  botId,
  children,
}: {
  botId: string
  children: ReactNode
}) {
  const panelRef = usePanelRef()
  const [collapsed, setCollapsed] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [desktop, setDesktop] = useState<Desktop>({ status: "idle" })
  const [connecting, startConnecting] = useTransition()
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null)
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null)
  const showBillingToast = useBillingToast()

  // Fetches a fresh viewer URL, which also wakes a stopped sandbox. A new URL
  // reloads the viewer, so this doubles as reconnect
  const connect = useCallback(() => {
    startConnecting(async () => {
      setDesktop((current) =>
        current.status === "ready" ? current : { status: "loading" }
      )
      const result = await getBotDesktop(botId)
      if (!result.ok && result.billing) {
        showBillingToast(result.billing, result.error)
      }
      setDesktop(
        result.ok
          ? { status: "ready", url: result.url }
          : { status: "error", error: result.error }
      )
    })
  }, [botId, showBillingToast])

  // Connect the first time the panel opens, so chats that never look at the
  // screen don't wake the sandbox
  useEffect(() => {
    if (!collapsed && desktop.status === "idle") connect()
  }, [collapsed, desktop.status, connect])

  return (
    <DesktopPanelContext
      value={{
        panelRef,
        collapsed,
        setCollapsed,
        desktop,
        connect,
        connecting,
        fullscreen,
        setFullscreen,
        setPanelSlot,
        setDialogSlot,
      }}
    >
      {children}
      {desktop.status === "ready" && (
        <DesktopViewer
          url={desktop.url}
          slot={fullscreen ? dialogSlot : collapsed ? null : panelSlot}
          interactive={fullscreen}
        />
      )}
    </DesktopPanelContext>
  )
}

// The one and only viewer. Moving an iframe in the DOM reloads it and drops
// the VNC session, so it stays put in a fixed layer and follows whichever slot
// is showing instead
function DesktopViewer({
  url,
  slot,
  interactive,
}: {
  url: string
  slot: HTMLElement | null
  interactive: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    if (!slot) {
      layer.style.visibility = "hidden"
      return
    }

    // Track the slot every frame: it moves with panel resizes and the dialog's
    // open animation, neither of which a ResizeObserver fully reports
    let frame = 0
    let last = ""
    const sync = () => {
      const { top, left, width, height } = slot.getBoundingClientRect()
      const next = `${top},${left},${width},${height}`
      if (next !== last) {
        last = next
        Object.assign(layer.style, {
          visibility: width && height ? "visible" : "hidden",
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
        })
      }
      frame = requestAnimationFrame(sync)
    }
    sync()
    return () => cancelAnimationFrame(frame)
  }, [slot])

  return createPortal(
    <div
      ref={layerRef}
      // Above the open dialog when fullscreen; otherwise below every overlay
      className={cn(
        "invisible fixed overflow-hidden rounded-lg",
        interactive ? "z-[51]" : "pointer-events-none"
      )}
    >
      <iframe
        src={url}
        title="Bot screen"
        // Only the fullscreen viewer takes input; the preview is a button
        tabIndex={interactive ? 0 : -1}
        allow="clipboard-read; clipboard-write"
        className="size-full border-0 bg-black"
      />
    </div>,
    document.body
  )
}

export function DesktopPanel({ botName }: { botName: string }) {
  const {
    panelRef,
    setCollapsed,
    desktop,
    connect,
    connecting,
    fullscreen,
    setFullscreen,
    setPanelSlot,
    setDialogSlot,
  } = useDesktopPanel()

  return (
    <ResizablePanel
      id="desktop"
      panelRef={panelRef}
      collapsible
      collapsedSize="0%"
      defaultSize="0%"
      minSize="30%"
      onResize={(size) => setCollapsed(size.asPercentage === 0)}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center justify-end px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reconnect"
            className="text-muted-foreground"
            disabled={connecting}
            onClick={connect}
          >
            {connecting ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-6 pb-6">
          <Dialog
            open={fullscreen}
            // Keys and clicks belong to the remote desktop: only the close
            // button may close the dialog
            onOpenChange={(open, { reason }) => {
              if (open || reason === "close-press") setFullscreen(open)
            }}
            disablePointerDismissal
          >
            <DialogTrigger
              disabled={desktop.status !== "ready"}
              render={
                <button
                  type="button"
                  aria-label={`Open ${botName}'s screen`}
                  className="w-full rounded-xl bg-muted p-2 ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-zoom-in"
                />
              }
            >
              <AspectRatio
                ref={setPanelSlot}
                ratio={DESKTOP_RATIO}
                className="overflow-hidden rounded-lg"
              >
                {desktop.status === "error" ? (
                  <div className="flex size-full items-center justify-center p-4 text-sm text-muted-foreground">
                    {desktop.error}
                  </div>
                ) : (
                  <Skeleton className="size-full" />
                )}
              </AspectRatio>
            </DialogTrigger>
            <DialogContent className="flex h-[calc(100svh-2rem)] flex-col sm:max-w-[calc(100vw-2rem)]">
              <DialogTitle>{botName}&apos;s screen</DialogTitle>
              <div ref={setDialogSlot} className="min-h-0 flex-1" />
            </DialogContent>
          </Dialog>
          <p className="text-sm text-muted-foreground">
            {botName}&apos;s screen
          </p>
        </div>
      </div>
    </ResizablePanel>
  )
}

export function DesktopPanelToggle({ className }: { className?: string }) {
  const { panelRef, collapsed } = useDesktopPanel()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={collapsed ? "Show desktop" : "Hide desktop"}
      aria-pressed={!collapsed}
      className={className}
      onClick={() => {
        const panel = panelRef.current
        if (!panel) return
        if (panel.isCollapsed()) panel.expand()
        else panel.collapse()
      }}
    >
      <MonitorIcon />
    </Button>
  )
}
