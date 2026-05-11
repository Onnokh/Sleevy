import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, useCommandState } from "cmdk"
import { useRouter } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Inbox, Library, Keyboard, Settings, Plus, Monitor } from "lucide-react"
import { Description as DialogDescription, Title as DialogTitle } from "@radix-ui/react-dialog"

import type { SavedItem } from "../../sleevy/saved-items"
import { CaptureCommandItem } from "../capture-command-item/capture-command-item"
import { useKeyboardNav } from "../../contexts/keyboard-nav-context"
import { useTheme } from "../../contexts/theme-context"
import { useCapture } from "../../sleevy/saved-items"
import "./command-palette.scss"

type SavedItemsResponse = { readonly savedItems: SavedItem[] }
type ModifierKey = "Ctrl" | "Cmd"

function faviconUrl(host: string) {
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${host}&size=32`
}

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

const ICON_SIZE = 14
const COMMAND_VALUES = {
  inbox: "nav:inbox",
  library: "nav:library",
  settings: "nav:settings",
  captureUrl: "action:capture-url",
  keyboardShortcuts: "action:keyboard-shortcuts",
  themeToggle: "theme:toggle",
} as const

function shortcutForValue(value: string, modifierKey: ModifierKey): string | null {
  if (value.startsWith("saved:")) {
    const shortcutNumber = value.match(/^saved:(\d+):/)?.[1]
    return shortcutNumber ? `${modifierKey} ${shortcutNumber}` : null
  }

  switch (value) {
    case COMMAND_VALUES.inbox:
      return `${modifierKey} I`
    case COMMAND_VALUES.library:
      return `${modifierKey} L`
    case COMMAND_VALUES.settings:
      return `${modifierKey} ,`
    case COMMAND_VALUES.captureUrl:
      return `${modifierKey} N`
    case COMMAND_VALUES.keyboardShortcuts:
      return `${modifierKey} ?`
    default:
      return null
  }
}

function footerActionForValue(value: string | undefined): string {
  if (!value) return "Run"
  if (value.startsWith("capture:")) return "Capture"
  if (value.startsWith("saved:")) return "Open"
  if (value.startsWith("theme:")) return "Apply"
  if (value.startsWith("nav:")) return "Navigate"
  if (value === COMMAND_VALUES.captureUrl) return "Focus"
  if (value === COMMAND_VALUES.keyboardShortcuts) return "Open"

  return "Run"
}

function CommandPaletteFooter() {
  const selectedValue = useCommandState((state) => state.value)
  const footerAction = footerActionForValue(selectedValue)

  return (
    <div className="cmdk-footer">
      <span className="cmdk-footer-hint">
        {footerAction} <kbd>Enter</kbd>
      </span>
    </div>
  )
}

function ShortcutKeys({ shortcut, className }: { readonly shortcut: string; readonly className?: string }) {
  return (
    <span className={className ?? "cmdk-shortcut"}>
      {shortcut.split(" ").map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  )
}

function CommandItemMeta({
  action,
  modifierKey,
  shortcut,
}: {
  readonly action: string
  readonly modifierKey: ModifierKey | null
  readonly shortcut: string | null
}) {
  if (modifierKey && shortcut) {
    return <ShortcutKeys shortcut={shortcut} className="cmdk-item-shortcut" />
  }

  return <span className="cmdk-item-type">{action}</span>
}

function SearchSubItem(props: ComponentProps<typeof CommandItem>) {
  const search = useCommandState((state) => state.search)
  if (!search) return null

  return <CommandItem {...props} />
}

function useHeldModifier(paletteOpen: boolean): ModifierKey | null {
  const [modifierKey, setModifierKey] = useState<ModifierKey | null>(null)

  useEffect(() => {
    if (!paletteOpen) {
      setModifierKey(null)
      return
    }

    const syncModifier = (nextModifier: ModifierKey | null) => {
      setModifierKey((currentModifier) => currentModifier === nextModifier ? currentModifier : nextModifier)
    }

    const modifierFromEvent = (event: KeyboardEvent) => {
      if (event.metaKey) return "Cmd"
      if (event.ctrlKey) return "Ctrl"
      return null
    }

    const handleKeyDown = (event: KeyboardEvent) => syncModifier(modifierFromEvent(event))

    const handleKeyUp = (event: KeyboardEvent) => {
      syncModifier(modifierFromEvent(event))
    }

    const handleBlur = () => syncModifier(null)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleBlur)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleBlur)
    }
  }, [paletteOpen])

  return modifierKey
}

export function CommandPalette() {
  const { paletteOpen, closePalette, openCaptureDialog, setHelpOpen } = useKeyboardNav()
  const router = useRouter()
  const queryClient = useQueryClient()
  const capture = useCapture()
  const { resolvedTheme, setTheme } = useTheme()
  const [search, setSearch] = useState("")
  const modifierKey = useHeldModifier(paletteOpen)

  const items = queryClient.getQueryData<SavedItemsResponse>(["saved-items"])?.savedItems ?? []
  const shortcutItems = useMemo(() => items.slice(0, 9), [items])

  const urlDetected = useMemo(() => isUrl(search.trim()), [search])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closePalette()
      setSearch("")
    }
  }

  const runAndClose = useCallback((fn: () => void) => {
    fn()
    closePalette()
    setSearch("")
  }, [closePalette])
  const runAndCloseRef = useRef(runAndClose)
  runAndCloseRef.current = runAndClose

  const openCapture = useCallback((initialUrl = "") => {
    closePalette()
    setSearch("")
    setTimeout(() => {
      openCaptureDialog(initialUrl)
    }, 0)
  }, [closePalette, openCaptureDialog])
  const openCaptureRef = useRef(openCapture)
  openCaptureRef.current = openCapture

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  const captureFromPalette = useCallback((url: string) => {
    capture.captureUrl(url, () => {
      closePalette()
      setSearch("")
    })
  }, [capture, closePalette])

  useEffect(() => {
    if (!paletteOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return

      if (/^[1-9]$/.test(event.key)) {
        const item = shortcutItems[Number(event.key) - 1]
        if (!item) return

        event.preventDefault()
        runAndCloseRef.current(() => {
          window.open(item.originalUrl, "_blank", "noreferrer")
        })
        return
      }

      const key = event.key.toLowerCase()
      const isHandledShortcut = key === "i" || key === "l" || key === "," || key === "n" || event.key === "?"
      if (!isHandledShortcut) return

      event.preventDefault()
      if (key === "i") runAndCloseRef.current(() => void router.navigate({ to: "/" }))
      else if (key === "l") runAndCloseRef.current(() => void router.navigate({ to: "/library" }))
      else if (key === ",") runAndCloseRef.current(() => void router.navigate({ to: "/settings" }))
      else if (key === "n") openCaptureRef.current()
      else if (event.key === "?") runAndCloseRef.current(() => setHelpOpen(true))
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [paletteOpen, router, setHelpOpen, shortcutItems])

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={handleOpenChange}
      label="Command palette"
      loop
      vimBindings={false}
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
      filter={urlDetected ? () => 1 : undefined}
    >
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <DialogDescription className="sr-only">Search saved items, navigate, or run app actions.</DialogDescription>
      <CommandInput
        placeholder="Search or paste a URL..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        {urlDetected && (
          <CommandGroup forceMount>
            <CaptureCommandItem
              url={search.trim()}
              disabled={capture.isPending}
              actionLabel={capture.isPending ? "Saving..." : "Capture"}
              onSelect={() => captureFromPalette(search.trim())}
            />
          </CommandGroup>
        )}

        <CommandGroup heading="Results">
          {items.map((item, index) => {
            const shortcut = index < 9 && modifierKey ? `${modifierKey} ${index + 1}` : null

            return (
            <CommandItem
              key={item.id}
              value={index < 9 ? `saved:${index + 1}:${item.id}` : `saved:${item.id}`}
              keywords={[item.host, item.title ?? ""]}
              onSelect={() => runAndClose(() => {
                window.open(item.originalUrl, "_blank", "noreferrer")
              })}
            >
              <img src={faviconUrl(item.host)} alt="" width={ICON_SIZE} height={ICON_SIZE} className="cmdk-favicon" />
              <div className="cmdk-item-text">
                <span className="cmdk-item-title">{item.title ?? item.host}</span>
                {item.title && <span className="cmdk-item-host">{item.host}</span>}
              </div>
              <CommandItemMeta action="Saved" modifierKey={modifierKey} shortcut={shortcut} />
            </CommandItem>
            )
          })}

          <CommandItem
            value={COMMAND_VALUES.inbox}
            keywords={["go to inbox", "inbox"]}
            onSelect={() => runAndClose(() => void router.navigate({ to: "/" }))}
          >
            <Inbox size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Inbox</span>
            </div>
            <CommandItemMeta action="Navigation" modifierKey={modifierKey} shortcut={shortcutForValue(COMMAND_VALUES.inbox, modifierKey ?? "Ctrl")} />
          </CommandItem>
          <CommandItem
            value={COMMAND_VALUES.library}
            keywords={["go to library", "library"]}
            onSelect={() => runAndClose(() => void router.navigate({ to: "/library" }))}
          >
            <Library size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Library</span>
            </div>
            <CommandItemMeta action="Navigation" modifierKey={modifierKey} shortcut={shortcutForValue(COMMAND_VALUES.library, modifierKey ?? "Ctrl")} />
          </CommandItem>
          <CommandItem
            value={COMMAND_VALUES.settings}
            keywords={["go to settings", "settings", "appearance", "theme"]}
            onSelect={() => runAndClose(() => void router.navigate({ to: "/settings" }))}
          >
            <Settings size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Settings</span>
            </div>
            <CommandItemMeta action="Navigation" modifierKey={modifierKey} shortcut={shortcutForValue(COMMAND_VALUES.settings, modifierKey ?? "Ctrl")} />
          </CommandItem>

          <SearchSubItem
            value={COMMAND_VALUES.themeToggle}
            keywords={["toggle theme change appearance light dark"]}
            onSelect={() => runAndClose(toggleTheme)}
          >
            <Monitor size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Toggle theme</span>
            </div>
            <CommandItemMeta action="Theme" modifierKey={modifierKey} shortcut={null} />
          </SearchSubItem>

          <CommandItem
            value={COMMAND_VALUES.captureUrl}
            keywords={["capture url"]}
            onSelect={() => openCapture()}
          >
            <Plus size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Capture URL</span>
            </div>
            <CommandItemMeta action="Action" modifierKey={modifierKey} shortcut={shortcutForValue(COMMAND_VALUES.captureUrl, modifierKey ?? "Ctrl")} />
          </CommandItem>
          <CommandItem
            value={COMMAND_VALUES.keyboardShortcuts}
            keywords={["keyboard shortcuts"]}
            onSelect={() => runAndClose(() => setHelpOpen(true))}
          >
            <Keyboard size={ICON_SIZE} className="cmdk-icon" />
            <div className="cmdk-item-text">
              <span className="cmdk-item-title">Keyboard Shortcuts</span>
            </div>
            <CommandItemMeta action="Action" modifierKey={modifierKey} shortcut={shortcutForValue(COMMAND_VALUES.keyboardShortcuts, modifierKey ?? "Ctrl")} />
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <CommandPaletteFooter />
    </CommandDialog>
  )
}
