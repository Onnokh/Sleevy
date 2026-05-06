import { type FormEvent, useState } from "react"

import { useApiKeys } from "../../sleeve/api-keys"
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
    <section>
      <div className={styles.header}>
        <h2>API Keys</h2>
        <form onSubmit={submitCreate} className="capture-form">
          <InputField
            type="text"
            placeholder="Key name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </div>

      {revealedKey ? (
        <div className={styles.revealed}>
          <div className={styles["revealed-header"]}>
            <strong>New API key created</strong>
            <Button variant="ghost" type="button" onClick={() => void copyKey()}>
              {copiedState === "done" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className={styles["revealed-value"]}>{revealedKey}</pre>
          <span className={styles["revealed-hint"]}>Copy this key now — it won't be shown again.</span>
        </div>
      ) : null}

      {isLoading ? <p>Loading...</p> : null}
      {isError ? <p>Could not load API keys.</p> : null}

      {!isLoading && !isError ? (
        keys.length === 0 ? (
          <p>No API keys yet.</p>
        ) : (
          <ul className="item-list">
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

      {panelError ? <pre>{panelError}</pre> : null}
    </section>
  )
}
