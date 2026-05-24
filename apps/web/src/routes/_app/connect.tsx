import { createFileRoute } from "@tanstack/react-router"

import { ConnectPage } from "../../pages/connect-page"

export const Route = createFileRoute("/_app/connect")({
  head: () => ({
    meta: [{ title: "Connect a device - Sleevy" }],
  }),
  component: ConnectPage,
})
