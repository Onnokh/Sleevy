import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"

import { authClient } from "./auth"
import { AccountMenu } from "./components/account-menu/account-menu"
import { Button } from "./components/ui/button/button"
import { SleevePage } from "./pages/sleeve-page"
import { LibraryPage } from "./pages/library-page"
import { SettingsPage } from "./pages/settings-page"
import "./styles.css"

const queryClient = new QueryClient()

// --- Routes ---

const rootRoute = createRootRoute({ component: RootLayout })

const sleeveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: SleevePage,
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

const routeTree = rootRoute.addChildren([sleeveRoute, libraryRoute, settingsRoute])

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
    return <div className="sign-in"><p>Loading...</p></div>
  }

  if (!session) return <SignIn />

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-top">
          <span className="logo">Sleeve</span>
          <nav className="sidebar-nav">
            <Link to="/" className="nav-link" activeOptions={{ exact: true }} activeProps={{ className: "nav-link active" }}>
              Sleeve
            </Link>
            <Link to="/library" className="nav-link" activeProps={{ className: "nav-link active" }}>
              Library
            </Link>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <AccountMenu user={session.user} />
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
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
      <h1>Sleeve</h1>
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
