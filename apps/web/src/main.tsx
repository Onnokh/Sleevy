import {
  Link,
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { StrictMode, type FormEvent, useState } from "react"
import { createRoot } from "react-dom/client"

import { getSession, signInWithGoogle, signOut, type AuthSession } from "./auth"
import { ApiKeysPanel } from "./components/api-keys/api-keys"
import { SavedCard } from "./components/saved-card/saved-card"
import { Button } from "./components/ui/button/button"
import { InputField } from "./components/ui/input-field/input-field"
import "./styles.css"

type RouterContext = {
  readonly session: AuthSession | null
}

type SavedItem = {
  readonly id: string
  readonly originalUrl: string
  readonly host: string
  readonly title?: string
  readonly description?: string
  readonly siteName?: string
  readonly imageUrl?: string
  readonly previewSummary?: string
  readonly enrichmentStatus: "pending" | "enriched" | "failed"
  readonly isRead: boolean
  readonly lastSavedAt: string
}

type SavedItemsResponse = {
  readonly savedItems: SavedItem[]
}

type CaptureResponse = {
  readonly savedItem: SavedItem
  readonly captureResult: "created" | "updated"
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4001"

const queryClient = new QueryClient()

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<T>
}

// --- Routes ---

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

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

const router = createRouter({
  routeTree,
  context: { session: null },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// --- Layout ---

function RootLayout() {
  const session = rootRoute.useRouteContext().session
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
            <Link to="/settings" className="nav-link" activeProps={{ className: "nav-link active" }}>
              Settings
            </Link>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <span className="account-email">{session.user.email}</span>
          <Button variant="ghost" type="button" onClick={() => void signOut()}>Sign out</Button>
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
    try {
      await signInWithGoogle()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed.")
      setIsSigningIn(false)
    }
  }

  return (
    <div className="sign-in">
      <h1>Label</h1>
      <p>Continue with your Google account.</p>
      <Button type="button" disabled={isSigningIn} onClick={() => void startSignIn()}>
        {isSigningIn ? "Opening Google..." : "Continue with Google"}
      </Button>
      {error ? <pre>{error}</pre> : null}
    </div>
  )
}

// --- Shared hooks ---

function useSavedItems() {
  return useQuery({
    queryKey: ["saved-items"],
    queryFn: () => apiFetch<SavedItemsResponse>("/v1/saved-items"),
    staleTime: 30_000,
  })
}

function useCapture() {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (inputUrl: string) =>
      apiFetch<CaptureResponse>("/v1/captures", {
        method: "POST",
        body: JSON.stringify({ url: inputUrl }),
      }),
    onSuccess: async () => {
      setUrl("")
      setFormError(null)
      await queryClient.invalidateQueries({ queryKey: ["saved-items"] })
    },
    onError: (cause) => {
      setFormError(cause instanceof Error ? cause.message : "Capture failed.")
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setFormError("Paste a URL first.")
      return
    }
    setFormError(null)
    mutation.mutate(trimmed)
  }

  return { url, setUrl, formError, isPending: mutation.isPending, submit }
}

function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      fetch(`${apiBaseUrl}/v1/saved-items/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((response) => {
        if (!response.ok) throw new Error("Delete failed")
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["saved-items"] })
      const previous = queryClient.getQueryData<SavedItemsResponse>(["saved-items"])
      if (previous) {
        queryClient.setQueryData<SavedItemsResponse>(["saved-items"], {
          savedItems: previous.savedItems.filter((item) => item.id !== id),
        })
      }
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["saved-items"], context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saved-items"] }),
  })
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

const session = await getSession()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ session }} />
    </QueryClientProvider>
  </StrictMode>,
)
