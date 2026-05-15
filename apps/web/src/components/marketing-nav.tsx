import { Link } from "@tanstack/react-router"

import { authClient } from "../auth"
import { Logo } from "../Logo"

export function MarketingNav() {
  const { data: session } = authClient.useSession()
  const appButtonLabel = session ? "Companion" : "Login"

  return (
    <nav className="marketing-nav" aria-label="Primary">
      <Link className="marketing-brand" to="/" aria-label="Sleevy home">
        <Logo size={42} />
      </Link>
      <div className="marketing-nav-actions">
        <Link className="marketing-nav-link" to="/docs">Docs</Link>
        <Link className="marketing-nav-link" to="/privacy">Privacy</Link>
        <Link className="marketing-login" to="/inbox">{appButtonLabel}</Link>
      </div>
    </nav>
  )
}
