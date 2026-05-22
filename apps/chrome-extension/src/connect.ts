declare const __SLEEVY_API_URL__: string
declare const __SLEEVY_WEB_URL__: string

const API_URL = __SLEEVY_API_URL__
const WEB_URL = __SLEEVY_WEB_URL__
const DEFAULT_SCOPES = ["saved-items:capture", "account:read"] as const

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return base64UrlEncode(new Uint8Array(digest))
}

function detectDeviceHint(): string {
  const ua = navigator.userAgent
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "Chrome on macOS"
  if (ua.includes("Windows")) return "Chrome on Windows"
  if (ua.includes("Linux")) return "Chrome on Linux"
  return "Google Chrome"
}

export type ConnectedAccount = {
  readonly apiKey: string
  readonly scopes: readonly string[]
  readonly label: string
}

export async function connectToSleevy(): Promise<ConnectedAccount> {
  const verifier = randomBase64Url(32)
  const codeChallenge = await sha256Base64Url(verifier)
  const state = randomBase64Url(16)
  const redirectUri = chrome.identity.getRedirectURL()
  const deviceHint = detectDeviceHint()

  const consentUrl = new URL(`${WEB_URL}/connect`)
  consentUrl.searchParams.set("client", "chrome-extension")
  consentUrl.searchParams.set("redirect_uri", redirectUri)
  consentUrl.searchParams.set("code_challenge", codeChallenge)
  consentUrl.searchParams.set("code_challenge_method", "S256")
  consentUrl.searchParams.set("scopes", DEFAULT_SCOPES.join(" "))
  consentUrl.searchParams.set("state", state)
  consentUrl.searchParams.set("device_hint", deviceHint)

  const callback = await chrome.identity.launchWebAuthFlow({
    url: consentUrl.toString(),
    interactive: true,
  })
  if (!callback) throw new Error("Authorization cancelled.")

  const callbackUrl = new URL(callback)
  const params = callbackUrl.searchParams.has("code") || callbackUrl.searchParams.has("error")
    ? callbackUrl.searchParams
    : new URLSearchParams(callbackUrl.hash.replace(/^#/, ""))

  const error = params.get("error")
  if (error) throw new Error(`Authorization denied (${error}).`)

  const code = params.get("code")
  const returnedState = params.get("state")
  if (!code) throw new Error("Authorization response missing code.")
  if (returnedState !== state) throw new Error("Authorization state mismatch.")

  const response = await fetch(`${API_URL}/connect/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: "chrome-extension",
      code,
      codeVerifier: verifier,
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Exchange failed (HTTP ${response.status}): ${body || "no body"}`)
  }
  const result = (await response.json()) as ConnectedAccount
  await chrome.storage.local.set({
    apiKey: result.apiKey,
    connectScopes: result.scopes,
    connectLabel: result.label,
  })
  return result
}

export async function disconnectFromSleevy(): Promise<void> {
  await chrome.storage.local.remove(["apiKey", "connectScopes", "connectLabel"])
}

export type CurrentConnection =
  | { readonly status: "connected"; readonly label: string; readonly scopes: readonly string[] }
  | { readonly status: "disconnected" }

export async function getCurrentConnection(): Promise<CurrentConnection> {
  const stored = await chrome.storage.local.get(["apiKey", "connectLabel", "connectScopes"])
  if (!stored.apiKey) return { status: "disconnected" }
  return {
    status: "connected",
    label: typeof stored.connectLabel === "string" ? stored.connectLabel : "Connected device",
    scopes: Array.isArray(stored.connectScopes) ? (stored.connectScopes as string[]) : [],
  }
}
