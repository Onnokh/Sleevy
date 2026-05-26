import { Outlet } from "@tanstack/react-router"

import { Logo } from "../../Logo"
import { useKeyboardNav } from "../../contexts/keyboard-nav-context"
import { AccountMenu } from "../account-menu/account-menu"
import { CaptureDialog } from "../capture-dialog/capture-dialog"
import { CommandPalette } from "../command-palette/command-palette"
import { FolderSidebar } from "../folders/folder-sidebar"
import { KeyboardHelp } from "../keyboard-help/keyboard-help"
import { LibraryNav, SourceFilterList, TagFilterList } from "../source-filter/source-filter"
import { SidebarCaptureButton } from "./sidebar-capture-button"

type User = Parameters<typeof AccountMenu>[0]["user"]

export function Dashboard({ user }: { readonly user: User }) {
  const { captureDialogOpen, captureDialogInitialUrl, closeCaptureDialog } = useKeyboardNav()

  return (
    <>
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
            <AccountMenu user={user} />
          </div>
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {captureDialogOpen ? <CaptureDialog initialUrl={captureDialogInitialUrl} onClose={closeCaptureDialog} /> : null}
      <CommandPalette />
      <KeyboardHelp />
    </>
  )
}
