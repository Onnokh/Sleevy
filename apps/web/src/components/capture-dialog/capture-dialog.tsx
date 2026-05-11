import { useEffect } from "react"
import { CommandDialog, CommandGroup, CommandInput, CommandList } from "cmdk"

import { CaptureCommandItem } from "../capture-command-item/capture-command-item"
import { useKeyboardNav } from "../../contexts/keyboard-nav-context"
import { useCapture } from "../../sleevy/saved-items"
import "../command-palette/command-palette.scss"

export function CaptureDialog() {
  const { captureDialogOpen, captureDialogInitialUrl, closeCaptureDialog } = useKeyboardNav()
  const capture = useCapture()
  const trimmedUrl = capture.url.trim()

  useEffect(() => {
    if (captureDialogOpen) {
      capture.setUrl(captureDialogInitialUrl)
    }
  }, [captureDialogInitialUrl, captureDialogOpen])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeCaptureDialog()
      capture.reset()
    }
  }

  const captureAndClose = () => {
    capture.captureUrl(trimmedUrl, () => {
      closeCaptureDialog()
    })
  }

  return (
    <CommandDialog
      open={captureDialogOpen}
      onOpenChange={handleOpenChange}
      label="Capture URL"
      shouldFilter={false}
      loop={false}
      vimBindings={false}
      overlayClassName="cmdk-overlay"
      contentClassName="cmdk-content"
    >
      <CommandInput
        placeholder="Paste a URL..."
        value={capture.url}
        onValueChange={capture.setUrl}
      />
      <CommandList>
        <CommandGroup forceMount>
          <CaptureCommandItem
            url={trimmedUrl}
            disabled={!trimmedUrl || capture.isPending}
            actionLabel={capture.isPending ? "Saving..." : "Capture"}
            onSelect={captureAndClose}
          />
        </CommandGroup>
      </CommandList>
      {capture.formError ? <div className="cmdk-error">{capture.formError}</div> : null}
    </CommandDialog>
  )
}
