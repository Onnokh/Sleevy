import { createFileRoute } from "@tanstack/react-router"
import { DocsPage } from "../../pages/docs-page"

export const Route = createFileRoute("/_marketing/docs")({
  head: () => ({
    meta: [{ title: "Docs - Sleevy" }],
  }),
  component: DocsPage,
})
