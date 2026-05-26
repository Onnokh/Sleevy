import { HotkeysProvider } from "@tanstack/react-hotkeys"

import { authClient } from "../../auth"
import { SignIn } from "../sign-in/sign-in"
import { SourceFilterProvider } from "../source-filter/source-filter"
import { KeyboardNavProvider } from "../../contexts/keyboard-nav-context"
import { Dashboard } from "./dashboard"
import "../../styles.css"

export function AppLayout() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><p>Loading&hellip;</p></div>
  }

  if (!session) return <SignIn />

  return (
    <HotkeysProvider>
      <SourceFilterProvider>
        <KeyboardNavProvider>
          <Dashboard user={session.user} />
        </KeyboardNavProvider>
      </SourceFilterProvider>
    </HotkeysProvider>
  )
}
