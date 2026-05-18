import { createFileRoute } from "@tanstack/react-router"
import { SettingsPage } from "../../pages/settings-page"

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [{ title: "Settings - Sleevy" }],
  }),
  component: SettingsPage,
})
