import { useMemo, useState } from "react"
import { useSearch } from "@tanstack/react-router"

import { authClient } from "../auth"
import { apiFetch } from "../sleevy/api"
import styles from "./connect-page.module.scss"

type ClientId = "chrome-extension" | "raycast"

const CLIENT_DISPLAY: Record<ClientId, string> = {
  "chrome-extension": "Google Chrome",
  raycast: "Raycast",
}

const CLIENT_LOGO: Record<ClientId, string> = {
  "chrome-extension": "/chrome-76.webp",
  raycast: "/raycast-82.webp",
}

const SCOPE_LABELS: Record<string, { title: string; description: string }> = {
  "saved-items:capture": {
    title: "Save new items",
    description: "Capture web pages into your Sleevy queue.",
  },
  "saved-items:read": {
    title: "Read your saved items",
    description: "See your queue, library, and item details.",
  },
  "saved-items:write": {
    title: "Update your saved items",
    description: "Mark items read, unread, or opened.",
  },
  "saved-items:delete": {
    title: "Delete saved items",
    description: "Permanently remove items from your library.",
  },
  "account:read": {
    title: "See your account",
    description: "Read your name and email to display a Connected as… label.",
  },
}

type ParsedRequest =
  | { ok: true; client: ClientId; redirectUri: string; codeChallenge: string; scopes: string[]; label: string; deviceHint: string | undefined; state: string }
  | { ok: false; error: string }

function parseRequest(search: Record<string, unknown>): ParsedRequest {
  const get = (key: string) => {
    const value = search[key]
    return typeof value === "string" ? value : undefined
  }

  const client = get("client")
  const redirectUri = get("redirect_uri")
  const codeChallenge = get("code_challenge")
  const codeChallengeMethod = get("code_challenge_method")
  const scopesRaw = get("scopes") ?? get("scope") ?? ""
  const state = get("state") ?? ""
  const deviceHint = get("device_hint")

  if (client !== "chrome-extension" && client !== "raycast") {
    return { ok: false, error: "Unknown client." }
  }
  if (!redirectUri) return { ok: false, error: "Missing redirect_uri." }
  if (!codeChallenge) return { ok: false, error: "Missing code_challenge." }
  if (codeChallengeMethod !== "S256") return { ok: false, error: "Only PKCE S256 is supported." }

  const scopes = scopesRaw.split(/[\s,]+/).filter(Boolean)
  if (scopes.length === 0) return { ok: false, error: "No scopes requested." }

  return {
    ok: true,
    client,
    redirectUri,
    codeChallenge,
    scopes,
    label: deviceHint ?? `${CLIENT_DISPLAY[client]}`,
    deviceHint,
    state,
  }
}

function buildRedirect(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function ConnectPage() {
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const { data: session } = authClient.useSession()

  const parsed = useMemo(() => parseRequest(search), [search])

  const [granted, setGranted] = useState<Record<string, boolean>>(() => {
    if (!parsed.ok) return {}
    return Object.fromEntries(parsed.scopes.map((s) => [s, true]))
  })
  const [label, setLabel] = useState(parsed.ok ? parsed.label : "")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!parsed.ok) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Connection request invalid</h1>
            <p className={styles.subtitle}>{parsed.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const clientName = CLIENT_DISPLAY[parsed.client]

  const approve = async () => {
    setSubmitting(true)
    setSubmitError(null)
    const scopes = parsed.scopes.filter((scope) => granted[scope])
    try {
      const { code } = await apiFetch<{ code: string }>("/connect/authorize", {
        method: "POST",
        body: JSON.stringify({
          client: parsed.client,
          redirectUri: parsed.redirectUri,
          codeChallenge: parsed.codeChallenge,
          codeChallengeMethod: "S256",
          scopes,
          label: label.trim() || clientName,
          ...(parsed.deviceHint ? { deviceHint: parsed.deviceHint } : {}),
        }),
      })
      window.location.replace(buildRedirect(parsed.redirectUri, { code, state: parsed.state }))
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not complete the request.")
      setSubmitting(false)
    }
  }

  const cancel = () => {
    window.location.replace(
      buildRedirect(parsed.redirectUri, { error: "access_denied", state: parsed.state }),
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icons} aria-hidden="true">
          <div className={`${styles.iconBubble} ${styles.iconBubbleClient}`}>
            <img src={CLIENT_LOGO[parsed.client]} alt="" />
          </div>
          <div className={`${styles.iconBubble} ${styles.iconBubbleSleevy}`}>
            <img src="/app-icon-160.webp" alt="" />
          </div>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Connect {clientName} to Sleevy</h1>
          {session?.user ? (
            <p className={styles.subtitle}>Signed in as {session.user.email}</p>
          ) : null}
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>{clientName} would like to</p>
          <ul className={styles.scopes}>
            {parsed.scopes.map((scope) => {
              const meta = SCOPE_LABELS[scope] ?? { title: scope, description: "" }
              return (
                <li key={scope}>
                  <label className={styles.scopeItem}>
                    <input
                      type="checkbox"
                      checked={granted[scope] ?? false}
                      onChange={(event) =>
                        setGranted((prev) => ({ ...prev, [scope]: event.target.checked }))
                      }
                    />
                    <span className={styles.scopeBody}>
                      <span className={styles.scopeTitle}>{meta.title}</span>
                      {meta.description ? (
                        <span className={styles.scopeDescription}>{meta.description}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Device label</p>
          <input
            type="text"
            className={styles.labelInput}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={clientName}
          />
        </div>

        {submitError ? <pre className={styles.error}>{submitError}</pre> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.pill}
            onClick={cancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.pill} ${styles.pillPrimary}`}
            onClick={() => void approve()}
            disabled={submitting}
          >
            {submitting ? "Authorizing…" : "Authorize"}
          </button>
        </div>
      </div>
    </div>
  )
}
