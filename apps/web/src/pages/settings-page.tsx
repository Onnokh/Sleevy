import { AccountPanel } from "../components/account/account"
import { ApiKeysPanel } from "../components/api-keys/api-keys"

export function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div className="page-sections">
        <AccountPanel />
        <ApiKeysPanel />
      </div>
    </>
  )
}
