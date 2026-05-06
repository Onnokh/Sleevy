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
import { useCapture, useDeleteItem, useSavedItems } from "./saved-items"
import { AccountMenu } from "./components/account-menu/account-menu"
import { ApiKeysPanel } from "./components/api-keys/api-keys"
import { SavedCard } from "./components/saved-card/saved-card"
import { Button } from "./components/ui/button/button"
import { InputField } from "./components/ui/input-field/input-field"
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

// --- Pages ---

function SleevePage() {
  const savedItemsQuery = useSavedItems()
  const capture = useCapture()
  const deleteMutation = useDeleteItem()

  const items = (savedItemsQuery.data?.savedItems ?? []).filter((item) => !item.isRead)

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Your Sleeve</h1>
        <form onSubmit={capture.submit} className="capture-form">
          <InputField
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={capture.url}
            onChange={(event) => capture.setUrl(event.target.value)}
          />
          <Button type="submit" disabled={capture.isPending || !capture.url.trim()}>
            {capture.isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </div>
      {capture.formError ? <pre>{capture.formError}</pre> : null}

      {savedItemsQuery.isLoading ? <p>Loading...</p> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
        items.length === 0 ? (
          <p>Your sleeve is empty. Save something above.</p>
        ) : (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id}>
                <SavedCard item={item} onDelete={(id) => deleteMutation.mutate(id)} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  )
}

function LibraryPage() {
  const savedItemsQuery = useSavedItems()
  const deleteMutation = useDeleteItem()

  const items = savedItemsQuery.data?.savedItems ?? []

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Library</h1>
      </div>

      {savedItemsQuery.isLoading ? <p>Loading...</p> : null}
      {savedItemsQuery.isError ? <p>Could not load saved items.</p> : null}

      {!savedItemsQuery.isLoading && !savedItemsQuery.isError ? (
        items.length === 0 ? (
          <p>No saved items yet.</p>
        ) : (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id}>
                <SavedCard item={item} onDelete={(id) => deleteMutation.mutate(id)} />
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  )
}

function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <ApiKeysPanel />
    </>
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
