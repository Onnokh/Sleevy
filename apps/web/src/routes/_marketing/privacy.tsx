import { createFileRoute } from "@tanstack/react-router"
import { PrivacyPage } from "../../pages/privacy-page"

export const Route = createFileRoute("/_marketing/privacy")({
  component: PrivacyPage,
})
