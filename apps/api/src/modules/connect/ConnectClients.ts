import type { Scope } from "../auth/Scopes.js"

export const CONNECT_CLIENT_IDS = ["chrome-extension", "raycast"] as const

export type ConnectClientId = (typeof CONNECT_CLIENT_IDS)[number]

export type ConnectClient = {
  readonly id: ConnectClientId
  readonly displayName: string
  readonly allowedScopes: ReadonlySet<Scope>
  readonly defaultScopes: ReadonlyArray<Scope>
  readonly allowsRedirectUri: (uri: string) => boolean
}

const chromeExtensionRedirect = (uri: string) =>
  /^https:\/\/[a-p]{32}\.chromiumapp\.org(\/.*)?$/.test(uri)

const raycastRedirect = (uri: string) => {
  try {
    const url = new URL(uri)
    if (url.origin !== "https://raycast.com") return false
    if (url.pathname === "/redirect" && url.searchParams.has("packageName")) return true
    if (url.pathname === "/redirect/extension" && url.search === "") return true
    return false
  } catch {
    return false
  }
}

const chromeExtension: ConnectClient = {
  id: "chrome-extension",
  displayName: "Google Chrome",
  allowedScopes: new Set<Scope>([
    "saved-items:capture",
    "saved-items:read",
    "saved-items:write",
    "account:read",
  ]),
  defaultScopes: ["saved-items:capture", "account:read"],
  allowsRedirectUri: chromeExtensionRedirect,
}

const raycast: ConnectClient = {
  id: "raycast",
  displayName: "Raycast",
  allowedScopes: new Set<Scope>([
    "saved-items:capture",
    "saved-items:read",
    "saved-items:write",
    "account:read",
  ]),
  defaultScopes: ["saved-items:capture", "saved-items:read", "account:read"],
  allowsRedirectUri: raycastRedirect,
}

const REGISTRY: Record<ConnectClientId, ConnectClient> = {
  "chrome-extension": chromeExtension,
  raycast,
}

export const getConnectClient = (id: string): ConnectClient | undefined =>
  (CONNECT_CLIENT_IDS as ReadonlyArray<string>).includes(id)
    ? REGISTRY[id as ConnectClientId]
    : undefined
