import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { HotkeysProvider } from "@tanstack/react-hotkeys"
import { StrictMode, Suspense, lazy, useState } from "react"
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
import { MarketingNav } from "./components/marketing-nav"
import { HomePage } from "./pages/home-page"
import { SleevyPage } from "./pages/sleevy-page"
import { LibraryPage } from "./pages/library-page"
import { SettingsPage } from "./pages/settings-page"
import "./styles.css"

const queryClient = new QueryClient()
const brandmarkWhiteUrl = "/brandmark-white.svg"
const DocsPage = lazy(() => import("./pages/docs-page").then((module) => ({ default: module.DocsPage })))
applyInitialTheme()

// --- Routes ---

const rootRoute = createRootRoute({ component: RootLayout })

const marketingRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "marketing",
  component: MarketingLayout,
})

const homeRoute = createRoute({
  getParentRoute: () => marketingRoute,
  path: "/",
  component: HomePage,
})

const docsRoute = createRoute({
  getParentRoute: () => marketingRoute,
  path: "/docs",
  component: DocsRoute,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppLayout,
})

const inboxRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/inbox",
  component: SleevyPage,
})

const libraryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/library",
  component: LibraryPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  marketingRoute.addChildren([homeRoute, docsRoute]),
  appRoute.addChildren([inboxRoute, libraryRoute, settingsRoute]),
])

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// --- Layout ---

function RootLayout() {
  return <Outlet />
}

function MarketingLayout() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <Outlet />
      <div className="marketing-footer-band" />
    </main>
  )
}

function DocsRoute() {
  return (
    <Suspense fallback={<div className="docs-loading">Loading API reference...</div>}>
      <DocsPage />
    </Suspense>
  )
}

function CaptureDialogWrapper() {
  const { captureDialogOpen, captureDialogInitialUrl, closeCaptureDialog } = useKeyboardNav()
  if (!captureDialogOpen) return null
  return <CaptureDialog initialUrl={captureDialogInitialUrl} onClose={closeCaptureDialog} />
}

function AppLayout() {
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
      callbackURL: `${window.location.origin}/inbox`,
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
