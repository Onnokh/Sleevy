import { createFileRoute } from "@tanstack/react-router"
import { SleevyPage } from "../../pages/sleevy-page"

export const Route = createFileRoute("/_app/inbox")({
  head: () => ({
    meta: [{ title: "Inbox - Sleevy" }],
  }),
  component: SleevyPage,
})
