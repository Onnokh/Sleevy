import { Outlet, createFileRoute } from "@tanstack/react-router"
import { HotkeysProvider } from "@tanstack/react-hotkeys"
import { authClient } from "../auth"
import { AccountMenu } from "../components/account-menu/account-menu"
import { CaptureDialog } from "../components/capture-dialog/capture-dialog"
import { CommandPalette } from "../components/command-palette/command-palette"
import { KeyboardHelp } from "../components/keyboard-help/keyboard-help"
import { SourceFilterProvider, SourceFilterList, TagFilterList, LibraryNav } from "../components/source-filter/source-filter"
import { FolderSidebar } from "../components/folders/folder-sidebar"
import { KeyboardNavProvider, useKeyboardNav } from "../contexts/keyboard-nav-context"
import { SignIn } from "../components/sign-in/sign-in"
import { Button } from "../components/ui/button/button"
import { Logo } from "../Logo"
import "../styles.css"

const brandmarkWhiteUrl = "/brandmark-white.svg"

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
})

function CaptureDialogWrapper() {
  const { captureDialogOpen, captureDialogInitialUrl, closeCaptureDialog } = useKeyboardNav()
  if (!captureDialogOpen) return null
  return <CaptureDialog initialUrl={captureDialogInitialUrl} onClose={closeCaptureDialog} />
}

function AppLayout() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><p>Loading&hellip;</p></div>
  }

  if (!session) return <SignIn />

  return (
    <HotkeysProvider>
      <SourceFilterProvider>
        <KeyboardNavProvider>
          <div className="dashboard">
            <aside className="sidebar">
              <div className="sidebar-top">
                <Logo size={28} />
                <SidebarCaptureButton />
                <LibraryNav />
                <FolderSidebar />
                <TagFilterList />
                <SourceFilterList />
              </div>
              <div className="sidebar-bottom">
                <AccountMenu user={session.user} />
              </div>
            </aside>
            <main className="content">
              <Outlet />
            </main>
          </div>
          <CaptureDialogWrapper />
          <CommandPalette />
          <KeyboardHelp />
        </KeyboardNavProvider>
      </SourceFilterProvider>
    </HotkeysProvider>
  )
}

function SidebarCaptureButton() {
  const { openCaptureDialog } = useKeyboardNav()

  return (
    <Button type="button"className="sidebar-capture-button" onClick={() => openCaptureDialog()}>
      <img src={brandmarkWhiteUrl} alt="" className="sidebar-capture-brandmark" />
      <span>Add Item</span>
      <kbd>N</kbd>
    </Button>
  )
}
