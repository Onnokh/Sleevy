import { createFileRoute } from "@tanstack/react-router"
import { LibraryPage } from "../../pages/library-page"

export const Route = createFileRoute("/_app/library")({
  head: () => ({
    meta: [{ title: "Library - Sleevy" }],
  }),
  component: LibraryPage,
})
