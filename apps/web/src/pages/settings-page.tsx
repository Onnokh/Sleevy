import { AccountPanel } from "../components/account/account"
import { ApiKeysPanel } from "../components/api-keys/api-keys"
import { SourceNamePanel } from "../components/source-name/source-name"

export function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="page-sections">
        <AccountPanel />
        <SourceNamePanel />
        <ApiKeysPanel />
      </div>
    </>
  )
}
