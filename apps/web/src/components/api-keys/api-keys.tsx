import { type FormEvent, useState } from "react"
import { Plus } from "lucide-react"

import { useApiKeys } from "../../sleevy/api-keys"
import { Button } from "../ui/button/button"
import { InputField } from "../ui/input-field/input-field"
import { ApiKeyRow } from "./api-key-row"
import styles from "./api-keys.module.scss"

export function ApiKeysPanel() {
  const { keys, isLoading, isError, create, revoke } = useApiKeys()

  const [name, setName] = useState("")
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [copiedState, setCopiedState] = useState<"idle" | "done">("idle")

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPanelError(null)
    create.mutate(name, {
      onSuccess: ({ key }) => {
        setRevealedKey(key)
        setName("")
        setCopiedState("idle")
      },
      onError: (cause) => {
        setPanelError(cause instanceof Error ? cause.message : "Could not create API key.")
      },
    })
  }

  const copyKey = async () => {
    if (!revealedKey) return
    try {
      await navigator.clipboard.writeText(revealedKey)
      setCopiedState("done")
    } catch {
      setPanelError("Could not copy the API key.")
    }
  }

  const handleDeleteError = (cause: Error) => {
    setPanelError(cause instanceof Error ? cause.message : "Could not revoke API key.")
  }

  return (
    <section className="settings-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">API Keys</h2>
          <p className="section-description">For integrations</p>
        </div>
      </div>

      <div className="settings-stack">
        <form onSubmit={submitCreate} className="settings-form settings-form-inline">
          <InputField
            type="text"
            placeholder="Key name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={create.isPending} aria-label="Create API key" title="Create">
            <Plus size={16} aria-hidden="true" />
          </Button>
        </form>

        {revealedKey ? (
          <div className={styles.revealed}>
            <div className={styles["revealed-header"]}>
              <strong>New API key created</strong>
              <Button variant="ghost" type="button" onClick={() => void copyKey()}>
                {copiedState === "done" ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className={styles["revealed-value"]}>{revealedKey}</pre>
            <span className={styles["revealed-hint"]}>Copy this key now - it won't be shown again.</span>
          </div>
        ) : null}

        {isLoading ? <p className="settings-empty">Loading...</p> : null}
        {isError ? <p className="settings-empty">Could not load API keys.</p> : null}

        {!isLoading && !isError ? (
          keys.length === 0 ? (
            <p className="settings-empty">No API keys yet.</p>
          ) : (
            <ul className="item-list settings-list">
              {keys.map((apiKey) => (
                <li key={apiKey.id}>
                  <ApiKeyRow
                    apiKey={apiKey}
                    isDeleting={revoke.isPending && revoke.variables === apiKey.id}
                    onDelete={() => revoke.mutate(apiKey.id, { onError: handleDeleteError })}
                  />
                </li>
              ))}
            </ul>
          )
        ) : null}

        {panelError ? <pre className="settings-error">{panelError}</pre> : null}
      </div>
    </section>
  )
}
