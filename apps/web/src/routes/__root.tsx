/// <reference types="vite/client" />
import type { ReactNode } from "react"
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "../contexts/theme-context"
import "../styles/base.css"

const queryClient = new QueryClient()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "Sleevy is a scriptable bookmark manager app with an API for saving links from iOS, Raycast, Chrome, the web, scripts, and automations." },
      { title: "Sleevy - Scriptable Bookmark Manager App" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico" },
    ],
    scripts: [
      { src: "https://analytics.missingmounts.com/script.js", defer: true, "data-website-id": "5a9b28e3-aa4f-48a6-bdb0-c335a19de00c" },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
