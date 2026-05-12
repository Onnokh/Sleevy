import { Outlet, createFileRoute } from "@tanstack/react-router"
import { MarketingNav } from "../components/marketing-nav"
import "../styles/marketing.css"

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
})

function MarketingLayout() {
  return (
    <main className="marketing-page">
      <MarketingNav />
      <Outlet />
      <div className="marketing-footer-band" />
    </main>
  )
}
