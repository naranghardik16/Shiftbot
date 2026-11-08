# Mobile parity checklist

Shiftbot on phones (iOS Safari and Android Chrome, 360–430px), landscape phones and iPad, with desktop checked for regressions.

**Status:** every feature that works on desktop also works on a phone. No feature was hidden, removed or marked desktop-only.

Legend: ✅ verified in Playwright on the profiles below · ⚠️ works, with a limitation or something to check on a real device.

**Verified on:**

| Profile | Engine | Viewport |
| --- | --- | --- |
| iPhone SE | WebKit | 375×667 |
| iPhone 15 | WebKit | 390×844 |
| Pixel 7 | Chromium | 412×915 |
| iPhone 15 landscape | WebKit | 844×390 |
| iPad | WebKit | 768×1024 |
| Desktop | Chromium | 1440×900 |

All touch profiles used touch input (`hasTouch`, taps). Each profile ran the same 31-step flow, signed in with a Clerk testing token, and checked `document.documentElement.scrollWidth <= innerWidth` after every step. Screenshots and the JSON report are in `mobile-screenshots/`.

## Checklist

| Feature | Mobile treatment | Status |
| --- | --- | --- |
| **Sidebar access** (chat list, search, "+" menu, user menu) | `SidebarTrigger` in the chat header and in a new `MobileHeader` on home, usage and pricing, shown below `md` only. The sheet closes on any route change (chat link, search result, new group chat) and when you tap the chat that's already open. | ✅ all profiles |
| Chat search | The sidebar "Search" button opens it on touch. The ⌘K hint is hidden on `pointer: coarse`. On phones the dialog sits near the top, clear of the keyboard. The search input is 16px. | ✅ |
| New bot: template ToggleGroup, face shuffle, fields | The dialog is capped at `100dvh − 2rem` and scrolls inside itself. The footer stacks below `sm`. Inputs are 16px on touch, so iOS doesn't zoom. | ✅ |
| Edit bot / delete bot (with alert dialog) | Same dialog treatment. The alert dialog fits at 375px. | ✅ |
| New group chat: bot multi-select | Checkbox rows keep their extended hit area. | ✅ |
| Edit / rename / delete group chat | Same dialog treatment. | ✅ |
| Send a message, stop, submit | The composer has bottom safe-area padding and a 16px textarea on touch. The textarea is capped at `min(12rem, 30dvh)`, so a long draft scrolls instead of pushing Send off a short screen. | ✅ |
| Group chat recipient picker and recipient label | The Select opens above the composer. The badge stays `max-w-40` and truncates. | ✅ |
| Message list: markdown, tables, mermaid, math, code, long URLs | Streamdown's Tailwind classes are now generated (`@source`). Code blocks and tables scroll inside themselves. Long words wrap (`wrap-break-word`). KaTeX's stylesheet is loaded, so formulas render once and correctly; before, they rendered twice on desktop too. Tool-row titles wrap instead of pushing the chevron off the row. | ✅ no page-level horizontal scroll on any profile |
| Screenshots (`show_screen`) | Already `max-w-full`. | ✅ by inspection (no screenshot produced in the run) |
| Handoff rows, reasoning | Rendered through the same `ToolRow`, now wrapping. No reasoning UI is rendered by `chat.tsx`. | ✅ by inspection |
| Stick to bottom with the keyboard open or closed | New `StayAtBottomOnResize`. The library only followed its *content's* size, so a shorter view (keyboard, rotation) left the latest message hidden. It now re-pins when the scroll area shrinks and was at the bottom. `interactive-widget=resizes-content` makes Android shrink the layout above the keyboard. | ✅ emulated by shrinking the viewport to 55%: prompt on screen, list at the bottom before, during and after. ⚠️ the real iOS keyboard pans the visual viewport instead; check on a phone |
| **Bot desktop panel** | Below 768px the chat stays full width. The resizable split stays mounted but collapsed, so `Chat` never remounts. The handle is hidden. `DesktopPanelToggle` opens a bottom sheet with the live preview, reconnect, and loading/error states. The same iframe follows the sheet's slot through the existing portal (one iframe in every step). | ✅ |
| **Fullscreen interactive desktop** | Edge to edge on phones (`h-dvh`, safe-area padding). noVNC (`resize=scale`) letterboxes the 4:3 screen inside it. A tap at the centre reaches the iframe. Taps and Escape don't close it; only the close button does. | ✅ portrait 375×667 → slot 343×603. Landscape 844×390 → dialog 812×358 |
| Touch / keyboard in the remote desktop | noVNC's own control bar appears on touch devices, with an on-screen keyboard button, extra keys (Ctrl/Alt/Tab/Esc), clipboard and settings (visible in the screenshots). noVNC maps gestures itself: tap = left click, two-finger tap = right click, drag = drag, two-finger drag = scroll. | ⚠️ Playwright can't open a real soft keyboard or send multi-touch gestures, so on-screen keyboard input and gestures still need a check on a real phone |
| Theme | Only the `D` hotkey existed. Added a "Dark mode" / "Light mode" item to the user menu, on desktop too. | ✅ |
| Usage page | Mobile header, tighter padding below `md`, meter rows wrap. | ✅ |
| Pricing page (Clerk `PricingTable`) | Mobile header, tighter padding. | ✅ no horizontal scroll (full-page screenshots in `*/pricing-full.png`) |
| Sign in / sign up | `min-h-dvh`, padding, safe areas. Clerk's inputs are 16px on touch. | ✅ 360px, 375px and landscape (`mobile-screenshots/auth/`) |
| Hover-only UI | Audited: nothing in the rendered app is hover-only. Sidebar tooltips only show on the collapsed desktop sidebar, and the HoverCard/Tooltip parts of `prompt-input`/`message` aren't used. | ✅ |
| Tap targets | Every `Button` gets an invisible hit area of at least 44×44px on `pointer: coarse`, without changing how it looks. The resize handle is wider on touch. | ✅ |
| Viewport | `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`. User zoom is left enabled. | ✅ |
| Safe areas | Headers (top), composer, sheets, toasts and the fullscreen viewer (bottom). Sidebar and content are padded left/right for a landscape notch: the sidebar widens by the inset, so its contents keep their size. | ⚠️ insets are 0 in emulation; check on a notched iPhone in landscape |
| Landscape phones (≥768px wide) | Keep the desktop layout (768px breakpoint), with the touch rules (hit areas, 16px inputs). | ✅ |

## Results

| Profile | Steps passed |
| --- | --- |
| iPhone SE | 30/30 |
| iPhone 15 | 30/30 |
| iPhone 15 landscape | 30/30 |
| iPad | 30/30 |
| Desktop | 30/30 |
| Pixel 7 | 27/30, see below |

Pixel 7 passed every step in an earlier run. In the last run its three bot-reply steps timed out: the message was sent, but the turn sat queued. The test sessions had filled the Trigger.dev dev environment to about 25 concurrent agent runs, and idle chat runs live for up to 60 minutes. Desktop failed the same way until slots freed, then passed 30/30. Pixel 7 wasn't re-run at your request. No page-level horizontal scroll and no app console errors on any profile. The only console message, from noVNC inside the iframe in Chromium, was "VideoFrame was garbage collected".

## Bugs found and fixed during verification

1. **Taps on the desktop preview never opened the viewer on iOS.** WebKit routes touches to an iframe even when its layer has `pointer-events: none`, so once the remote screen was live, taps on the preview did nothing. A transparent shield over the preview now takes the tap and opens the viewer. The preview button still handles the keyboard.
2. **Phantom dead zone after using the viewer on iOS.** After the fullscreen viewer had taken input and been hidden, WebKit kept sending taps in its old area to the invisible iframe. That swallowed the "Create group" button and checkbox taps there. The hidden layer is now moved off-screen as well as hidden; it keeps its size, so noVNC doesn't rescale or reconnect.
3. **KaTeX had no stylesheet**, so math rendered twice with a stray root line. This happened on desktop too.
4. **Streamdown classes weren't being generated** (missing `@source`).

## Files changed

- `app/layout.tsx`: `viewport` export
- `app/globals.css`: Streamdown `@source` lines, 16px form controls on touch
- `app/(dashboard)/page.tsx`, `usage/page.tsx`, `pricing/page.tsx`: `MobileHeader`, `dvh`, mobile padding
- `app/(dashboard)/chats/[chatId]/page.tsx`: `dvh`, handle hidden on mobile and wider on touch
- `app/sign-in/…`, `app/sign-up/…`: `dvh`, padding, safe areas
- `components/mobile-header.tsx` (new)
- `components/app-sidebar.tsx`: close the sheet on navigation, theme item in the user menu
- `components/chat-header.tsx`: sidebar trigger, safe-area top
- `components/chat-search.tsx`: hide the ⌘K hint on touch
- `components/chat.tsx`: composer safe area and height cap, word wrapping, `StayAtBottomOnResize`
- `components/desktop-panel.tsx`: mobile bottom sheet, edge-to-edge fullscreen, tap shield, hidden layer moved off-screen
- `components/ai-elements/message.tsx`: KaTeX CSS
- `components/ai-elements/tool.tsx`: wrapping tool titles
- `components/ui/button.tsx`: 44px touch hit area
- `components/ui/dialog.tsx`: max height and internal scroll
- `components/ui/sheet.tsx`: safe-area padding, scrollable bottom sheet
- `components/ui/sidebar.tsx`: safe-area insets, `min-w-0` on the inset
- `components/ui/command.tsx`: top-aligned on phones
- `components/ui/toast.tsx`: above the safe area, `z-[60]` (above the viewer and dialogs)
- `hooks/use-mobile.ts`: `useSyncExternalStore` (same behaviour; fixes its lint error)
- `next.config.ts`: `allowedDevOrigins` for the LAN IP

No server actions, queries, schema or Trigger.dev tasks were changed.
