import { Button } from "../ui/button/button"
import { useKeyboardNav } from "../../contexts/keyboard-nav-context"

const brandmarkWhiteUrl = "/brandmark-white.svg"

export function SidebarCaptureButton() {
  const { openCaptureDialog } = useKeyboardNav()

  return (
    <Button type="button" className="sidebar-capture-button" onClick={() => openCaptureDialog()}>
      <img src={brandmarkWhiteUrl} alt="" className="sidebar-capture-brandmark" />
      <span>Add Item</span>
      <kbd>N</kbd>
    </Button>
  )
}
