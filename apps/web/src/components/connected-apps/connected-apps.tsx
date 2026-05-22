import { useState } from "react"

import {
  connectedClientOf,
  useApiKeys,
  type ApiKey,
  type ConnectedClientId,
} from "../../sleevy/api-keys"
import { Button } from "../ui/button/button"
import styles from "./connected-apps.module.scss"

const CLIENT_LOGO_SRC: Record<ConnectedClientId, string> = {
  "chrome-extension": "/chrome-76.webp",
  raycast: "/raycast-82.webp",
}

const CLIENT_LOGO_ALT: Record<ConnectedClientId, string> = {
  "chrome-extension": "Google Chrome",
  raycast: "Raycast",
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

const RELATIVE_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 31_536_000 },
  { unit: "month", seconds: 2_592_000 },
  { unit: "week", seconds: 604_800 },
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
]

function formatRelative(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const deltaSeconds = (date.getTime() - Date.now()) / 1000
  const absSeconds = Math.abs(deltaSeconds)
  if (absSeconds < 45) return "just now"
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (absSeconds >= seconds) {
      return relativeFormatter.format(Math.round(deltaSeconds / seconds), unit)
    }
  }
  return relativeFormatter.format(Math.round(deltaSeconds / 60), "minute")
}

function toTimestamp(value: string | Date | null | undefined): number {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

type ConnectedRow = {
  readonly key: ApiKey
  readonly client: ConnectedClientId
}

function connectedRows(keys: ApiKey[]): ConnectedRow[] {
  const rows: ConnectedRow[] = []
  for (const key of keys) {
    const client = connectedClientOf(key)
    if (client) rows.push({ key, client })
  }
  rows.sort((a, b) => {
    const aMs = toTimestamp(a.key.lastRequest) || toTimestamp(a.key.createdAt)
    const bMs = toTimestamp(b.key.lastRequest) || toTimestamp(b.key.createdAt)
    return bMs - aMs
  })
  return rows
}

export function ConnectedAppsPanel() {
  const { keys, isLoading, isError, revoke } = useApiKeys()
  const [panelError, setPanelError] = useState<string | null>(null)

  const rows = connectedRows(keys)

  return (
    <section className="settings-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Connected Apps</h2>
          <p className="section-description">Devices and clients linked via Connect to Sleevy</p>
        </div>
      </div>

      <div className="settings-stack">
        {isLoading ? <p className="settings-empty">Loading…</p> : null}
        {isError ? <p className="settings-empty">Could not load connected apps.</p> : null}

        {!isLoading && !isError ? (
          rows.length === 0 ? (
            <p className={styles.emptyState}>
              No devices connected yet. Click <strong>Connect to Sleevy</strong> in the Chrome extension or Raycast plugin to link this account.
            </p>
          ) : (
            <div className={styles.rows}>
              {rows.map(({ key, client }) => {
                const lastUsed = formatRelative(key.lastRequest)
                const isDeleting = revoke.isPending && revoke.variables === key.id
                const meta = lastUsed ? `Last used ${lastUsed}` : "Never used"
                return (
                  <div key={key.id} className={styles.row}>
                    <img
                      className={styles.rowLogo}
                      src={CLIENT_LOGO_SRC[client]}
                      alt={CLIENT_LOGO_ALT[client]}
                      width={24}
                      height={24}
                    />
                    <div className={styles.rowBody}>
                      <span className={styles.rowName}>{key.name?.trim() || "Connected device"}</span>
                      <span className={styles.rowMeta}>{meta}</span>
                    </div>
                    <Button
                      variant="ghost"
                      type="button"
                      disabled={isDeleting}
                      onClick={() =>
                        revoke.mutate(key.id, {
                          onError: (cause) =>
                            setPanelError(
                              cause instanceof Error ? cause.message : "Could not disconnect.",
                            ),
                        })
                      }
                    >
                      {isDeleting ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  </div>
                )
              })}
            </div>
          )
        ) : null}

        {panelError ? <pre className="settings-error">{panelError}</pre> : null}
      </div>
    </section>
  )
}
