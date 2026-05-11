import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HotkeysProvider } from "@tanstack/react-hotkeys"
import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"

import { authClient } from "./auth"
import { AccountMenu } from "./components/account-menu/account-menu"
import { CaptureDialog } from "./components/capture-dialog/capture-dialog"
import { CommandPalette } from "./components/command-palette/command-palette"
import { KeyboardHelp } from "./components/keyboard-help/keyboard-help"
import { SourceFilterProvider, SourceFilterList, TagFilterList, LibraryNav } from "./components/source-filter/source-filter"
import { KeyboardNavProvider, useKeyboardNav } from "./contexts/keyboard-nav-context"
import { ThemeProvider, applyInitialTheme } from "./contexts/theme-context"
import { Button } from "./components/ui/button/button"
import { Logo } from "./Logo"
import { SleevyPage } from "./pages/sleevy-page"
import { LibraryPage } from "./pages/library-page"
import { SettingsPage } from "./pages/settings-page"
import "./styles.css"

const queryClient = new QueryClient()
const brandmarkWhiteUrl = "/brandmark-white.svg"
applyInitialTheme()

// --- Routes ---

const rootRoute = createRootRoute({ component: RootLayout })

const sleevyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SleevyPage,
})

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: LibraryPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([sleevyRoute, libraryRoute, settingsRoute])

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// --- Layout ---

function RootLayout() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="sign-in"><p>Loading&hellip;</p></div>
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
          <CaptureDialog />
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
    <Button type="button" variant="ghost" className="sidebar-capture-button" onClick={() => openCaptureDialog()}>
      <img src={brandmarkWhiteUrl} alt="" className="sidebar-capture-brandmark" />
      <span>Add Item</span>
      <kbd>N</kbd>
    </Button>
  )
}

function SignIn() {
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const startSignIn = async () => {
    setError(null)
    setIsSigningIn(true)
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    })
    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed.")
      setIsSigningIn(false)
    }
  }

  return (
    <div className="sign-in">
      <Logo size={48} />
      <p>Continue with your Google account.</p>
      <Button type="button" disabled={isSigningIn} onClick={() => void startSignIn()}>
        {isSigningIn ? "Opening Google..." : "Continue with Google"}
      </Button>
      {error ? <pre>{error}</pre> : null}
    </div>
  )
}

// --- Bootstrap ---

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
