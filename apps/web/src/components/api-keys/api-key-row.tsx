import { useEffect, useRef, useState } from "react"

import type { ApiKey } from "../../sleeve/api-keys"
import { ContextMenu, type ContextMenuItem } from "../ui/context-menu/context-menu"
import styles from "./api-keys.module.scss"

type Props = {
  readonly apiKey: ApiKey
  readonly isDeleting: boolean
  readonly onDelete: () => void
}

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function ApiKeyRow({ apiKey, isDeleting, onDelete }: Props) {
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
