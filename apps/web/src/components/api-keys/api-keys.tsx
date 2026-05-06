import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useEffect, useRef, useState } from "react"

import { authClient } from "../../auth"
import { Button } from "../ui/button/button"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import { InputField } from "../ui/input-field/input-field"
import styles from "./api-keys.module.scss"

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

type ApiKeyRecord = NonNullable<Awaited<ReturnType<typeof authClient.apiKey.list>>["data"]>["apiKeys"][number]

function ApiKeyRow({
  apiKey,
  isDeleting,
  onDelete,
}: {
  readonly apiKey: ApiKeyRecord
  readonly isDeleting: boolean
  readonly onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const label = apiKey.name?.trim() || "Unnamed key"
  const prefix = apiKey.start || apiKey.prefix
  const createdAt = formatTimestamp(apiKey.createdAt)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copyPrefix = async () => {
    if (!prefix) return
    try {
      await navigator.clipboard.writeText(prefix)
      setCopied(true)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard not available */
    }
  }

  const items: readonly ContextMenuItem[] = [
    ...(prefix ? [{ key: "copy", label: "Copy key", onClick: copyPrefix }] : []),
    {
      key: "revoke",
      label: isDeleting ? "Revoking..." : "Revoke",
      destructive: true,
      disabled: isDeleting,
      onClick: onDelete,
    },
  ]

  return (
    <div className={styles.row}>
      <div className={styles.body}>
        <span className={styles.name}>{label}</span>
        <span className={styles.meta}>
          {prefix ?? null}
          {prefix && createdAt ? " · " : null}
          {createdAt ? `Created ${createdAt}` : null}
        </span>
      </div>

      {prefix && (
        <button type="button" className={styles.copy} onClick={() => void copyPrefix()}>
          {copied ? "Copied" : "Copy"}
        </button>
      )}

      <div className={styles["menu-wrapper"]}>
        <ContextMenu
          items={items}
          triggerClassName={styles["menu-trigger"]}
        />
      </div>
    </div>
  )
}

export function ApiKeysPanel() {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [copiedState, setCopiedState] = useState<"idle" | "done">("idle")

  const apiKeysQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const result = await authClient.apiKey.list()
      if (result.error) throw new Error(result.error.message)
      return result.data.apiKeys
    },
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: async (nextName: string) => {
      const result = await authClient.apiKey.create({ name: nextName.trim() || undefined })
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: ({ key }) => {
      setRevealedKey(key)
      setName("")
      setPanelError(null)
      setCopiedState("idle")
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
    onError: (cause) => {
      setPanelError(cause instanceof Error ? cause.message : "Could not create API key.")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const result = await authClient.apiKey.delete({ keyId })
      if (result.error) throw new Error(result.error.message)
    },
    onSuccess: () => {
      setPanelError(null)
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
    onError: (cause) => {
      setPanelError(cause instanceof Error ? cause.message : "Could not revoke API key.")
    },
  })

  const apiKeys = apiKeysQuery.data ?? []

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPanelError(null)
    createMutation.mutate(name)
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
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
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

      {apiKeysQuery.isLoading ? <p>Loading...</p> : null}
      {apiKeysQuery.isError ? <p>Could not load API keys.</p> : null}

      {!apiKeysQuery.isLoading && !apiKeysQuery.isError ? (
        apiKeys.length === 0 ? (
          <p>No API keys yet.</p>
        ) : (
          <ul className="item-list">
            {apiKeys.map((apiKey) => (
              <li key={apiKey.id}>
                <ApiKeyRow
                  apiKey={apiKey}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === apiKey.id}
                  onDelete={() => deleteMutation.mutate(apiKey.id)}
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
