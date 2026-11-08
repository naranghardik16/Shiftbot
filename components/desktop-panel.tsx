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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useBillingToast } from "@/hooks/use-billing-toast"
import { useIsMobile } from "@/hooks/use-mobile"

// Daytona desktops run at 1024x768 unless the sandbox sets VNC_RESOLUTION
const DESKTOP_RATIO = 4 / 3

type Desktop =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string }

type DesktopPanelContextValue = {
  panelRef: RefObject<PanelImperativeHandle | null>
  // Phones have no room for a split, so the screen opens in a sheet instead
  isMobile: boolean
  // Whether the screen is hidden: the panel is collapsed or the sheet closed
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

const DesktopPanelContext = createContext<DesktopPanelContextValue | null>(null)

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
  const isMobile = useIsMobile()

  // Crossing the breakpoint swaps the panel for the sheet or back, so start
  // from a hidden screen rather than a panel squeezed to a phone's width
  const [layoutIsMobile, setLayoutIsMobile] = useState(isMobile)
  if (layoutIsMobile !== isMobile) {
    setLayoutIsMobile(isMobile)
    setCollapsed(true)
  }
  useEffect(() => {
    panelRef.current?.collapse()
  }, [isMobile, panelRef])

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
        isMobile,
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
          // The mobile preview sits in a sheet, which is an overlay too
          raised={fullscreen || isMobile}
          onOpen={() => setFullscreen(true)}
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
  raised,
  onOpen,
}: {
  url: string
  slot: HTMLElement | null
  interactive: boolean
  raised: boolean
  // Opens the fullscreen viewer from the preview
  onOpen: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    if (!slot) {
      // Off screen as well as hidden: once the viewer has taken input, iOS
      // Safari keeps sending taps in its old spot to the hidden iframe. Its
      // size stays, so the remote screen doesn't rescale
      Object.assign(layer.style, { visibility: "hidden", left: "-200vw" })
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
      // Above the open dialog or sheet showing it; otherwise below every
      // overlay
      className={cn(
        "invisible fixed overflow-hidden rounded-lg",
        raised && "z-[51]"
      )}
    >
      <iframe
        src={url}
        title="Bot screen"
        // Only the fullscreen viewer takes input; the preview is a button
        tabIndex={interactive ? 0 : -1}
        allow="clipboard-read; clipboard-write"
        className={cn(
          "size-full border-0 bg-black",
          !interactive && "pointer-events-none"
        )}
      />
      {/* Over the preview, taps and clicks open the fullscreen viewer here:
          WebKit routes touches to an iframe even through pointer-events:
          none, so they never reach the preview button underneath. The
          button still opens it from the keyboard */}
      {!interactive && (
        <div
          aria-hidden
          className="absolute inset-0 cursor-zoom-in"
          onClick={onOpen}
        />
      )}
    </div>,
    document.body
  )
}

export function DesktopPanel({ botName }: { botName: string }) {
  const { panelRef, isMobile, collapsed, setCollapsed } = useDesktopPanel()

  return (
    <>
      {/* Stays in the group on phones too, empty and collapsed, so switching
          layouts never remounts the chat beside it */}
      <ResizablePanel
        id="desktop"
        panelRef={panelRef}
        collapsible
        collapsedSize="0%"
        defaultSize="0%"
        minSize="30%"
        onResize={(size) => {
          if (!isMobile) setCollapsed(size.asPercentage === 0)
        }}
      >
        {!isMobile && (
          <div className="flex h-full flex-col">
            <div className="flex h-12 shrink-0 items-center justify-end px-4">
              <ReconnectButton />
            </div>
            <DesktopScreen
              botName={botName}
              className="min-h-0 flex-1 px-6 pb-6"
              caption={`${botName}'s screen`}
            />
          </div>
        )}
      </ResizablePanel>
      {isMobile && (
        <Sheet open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
          <SheetContent
            side="bottom"
            className="gap-0 rounded-t-xl data-[side=bottom]:pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader className="flex-row items-center gap-2 py-3 pe-14">
              <SheetTitle className="min-w-0 flex-1 truncate">
                {botName}&apos;s screen
              </SheetTitle>
              <SheetDescription className="sr-only">
                A live view of {botName}&apos;s computer. Tap it to take
                control.
              </SheetDescription>
              <ReconnectButton />
            </SheetHeader>
            <DesktopScreen
              botName={botName}
              // Short enough for a landscape phone, where the sheet is short
              className="mx-auto w-full max-w-[calc((100dvh-9rem)*4/3)] px-4"
              caption="Tap the screen to take control"
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

function ReconnectButton() {
  const { connect, connecting } = useDesktopPanel()

  return (
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
  )
}

// The preview, which opens the fullscreen viewer, and its caption
function DesktopScreen({
  botName,
  caption,
  className,
}: {
  botName: string
  caption: string
  className?: string
}) {
  const { desktop, fullscreen, setFullscreen, setPanelSlot, setDialogSlot } =
    useDesktopPanel()

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
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
        {/* Edge to edge on phones, where every pixel of the screen counts */}
        <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col overflow-hidden max-md:h-dvh max-md:max-h-none max-md:max-w-none max-md:rounded-none max-md:pt-[max(1rem,env(safe-area-inset-top))] max-md:pr-[max(1rem,env(safe-area-inset-right))] max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pl-[max(1rem,env(safe-area-inset-left))] max-md:ring-0 sm:max-w-[calc(100vw-2rem)]">
          <DialogTitle className="pe-10">{botName}&apos;s screen</DialogTitle>
          <div ref={setDialogSlot} className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
      <p className="text-sm text-muted-foreground">{caption}</p>
    </div>
  )
}

export function DesktopPanelToggle({ className }: { className?: string }) {
  const { panelRef, isMobile, collapsed, setCollapsed } = useDesktopPanel()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={collapsed ? "Show desktop" : "Hide desktop"}
      aria-pressed={!collapsed}
      className={className}
      onClick={() => {
        if (isMobile) {
          setCollapsed(!collapsed)
          return
        }
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
