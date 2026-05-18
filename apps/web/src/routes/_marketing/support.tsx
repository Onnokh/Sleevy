import { createFileRoute } from "@tanstack/react-router"
import { SupportPage } from "../../pages/support-page"

export const Route = createFileRoute("/_marketing/support")({
  head: () => ({
    meta: [{ title: "Support - Sleevy" }],
  }),
  component: SupportPage,
})
