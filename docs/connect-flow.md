# Connect to Sleevy — Extension & Client Authorization Flow

A shared OAuth-style consent flow that lets first-party clients (Chrome extension, Raycast plugin, future automation) obtain a long-lived, scoped API Key without the user copy-pasting one. The web app's BetterAuth session is the trust root; clients never see the user's password or session cookie.

## Goals

- One-click "Connect to Sleevy" from any first-party client.
- Per-device, individually-revocable credentials labelled with client + device.
- Scopes baked in from day one so future clients can request least privilege.
- Same backend endpoints for Chrome and Raycast; only the client-side redirect glue differs.

## Non-goals

- Public/third-party OAuth. Clients are hardcoded first-party — no dynamic client registration, no consent for unknown apps.
- Refresh tokens. API Keys are long-lived; revocation happens via the Connected Apps page.

## Clients

| Client          | `client` id        | Redirect URI                                       | Library                              |
| --------------- | ------------------ | -------------------------------------------------- | ------------------------------------ |
| Chrome ext.     | `chrome-extension` | `https://<ext-id>.chromiumapp.org/`                | `chrome.identity.launchWebAuthFlow`  |
| Raycast plugin  | `raycast`          | `https://raycast.com/redirect`                     | `OAuth.PKCEClient` (Web redirect)    |

Allowed redirect URIs are hardcoded in the API per `client` id. Anything else 400s.

## Scopes

Scopes ride on BetterAuth's `apiKey` plugin `permissions` field (JSON-encoded `Record<string, string[]>`), so no schema migration is needed — only a convention.

Initial vocabulary:

| Scope                  | Allows                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `saved-items:capture`  | `POST /captures` and the supporting metadata read.                |
| `saved-items:read`     | `GET /saved-items`, list/detail/search.                           |
| `saved-items:write`    | Update read state (open, mark read/unread) on a Saved Item.       |
| `saved-items:delete`   | Permanently delete a Saved Item. Destructive and irreversible.    |
| `account:read`         | Read current user profile (for "Connected as …" UI in client).    |

Encoded as `{ "saved-items": ["capture", "read"], "account": ["read"] }`.

Delete is intentionally split from `write` because it's destructive. No first-party client in V1 requests it — full deletion lives in the web app, which authenticates by session cookie (full trust, scopes bypassed).

Default scopes per client (what the consent screen pre-checks):

- `chrome-extension`: `saved-items:capture`, `account:read`
- `raycast`: `saved-items:capture`, `saved-items:read`, `account:read`

Authorization middleware reads `key.permissions` and enforces per-route required scopes. A one-time data migration backfills `permissions` on every existing key with the full v1 scope set above — preserving today's behavior without granting anything net-new. After the migration, `permissions = null` is treated as zero scopes (deny by default), not full access. Future scopes added to the vocabulary do *not* retroactively apply to pre-existing keys; users opt into new capabilities by reconnecting or editing the key.

## Sequence

```
Client                      Web (sleevy.app)              API
  │                                │                        │
  │ 1. generate code_verifier      │                        │
  │    + code_challenge (S256)     │                        │
  │ 2. open /connect?client=…      │                        │
  │     &state=…&code_challenge=…  │                        │
  │     &redirect_uri=…&scopes=…   │                        │
  │───────────────────────────────▶│                        │
  │                                │ 3. require BetterAuth  │
  │                                │    session (else sign  │
  │                                │    in, then resume)    │
  │                                │ 4. render consent:     │
  │                                │    "Authorize <Client> │
  │                                │     on <Device>?       │
  │                                │     Scopes: […]"       │
  │                                │ 5. on Approve →        │
  │                                │    POST /connect/      │
  │                                │      authorize         │
  │                                │───────────────────────▶│
  │                                │                        │ 6. validate session,
  │                                │                        │    client+redirect_uri,
  │                                │                        │    scopes ⊆ allowed.
  │                                │                        │    Mint one-time code
  │                                │                        │    (5 min TTL, single
  │                                │                        │    use), store
  │                                │                        │    {code_challenge,
  │                                │                        │     userId, client,
  │                                │                        │     scopes, label}.
  │                                │◀───────────────────────│ → { code }
  │                                │ 7. 302 to redirect_uri │
  │                                │    #code=…&state=…     │
  │◀───────────────────────────────│                        │
  │ 8. POST /connect/exchange      │                        │
  │    { code, code_verifier,      │                        │
  │      client }                  │                        │
  │────────────────────────────────┼───────────────────────▶│
  │                                │                        │ 9. verify PKCE,
  │                                │                        │    consume code,
  │                                │                        │    mint API Key via
  │                                │                        │    BetterAuth apiKey
  │                                │                        │    plugin with
  │                                │                        │    permissions=scopes,
  │                                │                        │    name=label.
  │◀───────────────────────────────┼────────────────────────│ → { apiKey, scopes, label }
  │ 10. store in chrome.storage    │                        │
  │     / Raycast keychain.        │                        │
```

## Endpoints

Both endpoints live under the existing API project. The `/authorize` endpoint requires a BetterAuth session cookie; `/exchange` is unauthenticated (the PKCE verifier is the proof).

### `POST /connect/authorize`

Auth: BetterAuth session.

Request:
```ts
{
  client: "chrome-extension" | "raycast",
  redirect_uri: string,
  code_challenge: string,        // base64url(SHA256(verifier))
  code_challenge_method: "S256",
  scopes: string[],              // e.g. ["saved-items:capture", "account:read"]
  label: string,                 // e.g. "Chrome on MacBook Pro"
  state: string,                 // opaque, echoed in redirect for client to match
}
```

Response: `{ code: string }` — opaque, 32+ bytes, base64url. Web then redirects.

### `POST /connect/exchange`

Auth: none. PKCE is the proof.

Request:
```ts
{
  client: "chrome-extension" | "raycast",
  code: string,
  code_verifier: string,
}
```

Response:
```ts
{
  apiKey: string,                // shown once, never recoverable
  scopes: string[],
  label: string,
  expiresAt: null,               // long-lived
}
```

Errors: `invalid_code` (expired/consumed/unknown), `invalid_verifier`, `client_mismatch`.

## Storage

One new table or BetterAuth verification row for pending authorization codes. Minimal shape:

```
connect_code
  code             text primary key
  user_id          text not null
  client           text not null
  scopes           jsonb not null
  label            text not null
  code_challenge   text not null
  redirect_uri     text not null
  expires_at       timestamptz not null    -- now() + 5 min
  consumed_at      timestamptz             -- null until first use
```

A Postgres unique constraint plus an `update … where consumed_at is null returning *` makes single-use atomic. A cron sweep deletes expired rows daily; nothing else cares about them.

## Settings: two new sections

Both rendered as `<section className="settings-section">` blocks on the existing `/settings` page, sibling to **Appearance**. They draw from the same `apiKey` table but split by origin.

### Connected Apps

Keys issued via the `/connect` flow. Distinguished by `metadata.client` being a known first-party client id (`raycast`, `chrome-extension`, future `ios`).

One row per active connection, grouped by client with a fixed order:

- **Raycast** — label ("MacBook Pro"), scope chips, connected on …, **Disconnect**.
- **Google Chrome** — same.

Empty state per client: a "Connect Raycast" / "Connect Chrome" CTA linking to the install page. Connecting a second device for the same client appends another row under that client's header rather than replacing the first — users can have Chrome on laptop + Chrome on desktop.

### API Keys

Everything else in the `apiKey` table — manually-created keys (current paste-a-key flow) and post-migration legacy keys. Rendered as today's flat list of rows with name, last-used, scope chips, **Revoke**.

This section stays for power users and CI scripts. New "Create API Key" affordance can live here once we're ready; not in scope for the Connect flow itself.

### Why two sections

`metadata.client` is the only branching logic. Connected Apps gets a richer per-client UI (logo, "Connect …" CTA, grouped rows) because we know the client; API Keys stays generic because we don't. Splitting also nudges users toward the consent flow over raw key creation without removing the escape hatch.

## Client glue

### Chrome extension

```ts
// background.ts
async function connect() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const challenge = base64url(await sha256(verifier))
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)))

  const redirectUri = chrome.identity.getRedirectURL()
  const url = new URL("https://sleevy.app/connect")
  url.searchParams.set("client", "chrome-extension")
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("scopes", "saved-items:capture account:read")
  url.searchParams.set("state", state)

  const callback = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true })
  const params = new URLSearchParams(new URL(callback).hash.slice(1))
  if (params.get("state") !== state) throw new Error("state mismatch")

  const res = await fetch("https://api.sleevy.app/connect/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client: "chrome-extension", code: params.get("code"), code_verifier: verifier }),
  })
  const { apiKey, scopes, label } = await res.json()
  await chrome.storage.local.set({ apiKey, scopes, label })
}
```

The options page becomes a status surface ("Connected as alice@… · Chrome on MacBook Pro · [Disconnect]") rather than a key input. Key entry can stay as a hidden "advanced" affordance during transition.

### Raycast plugin

```ts
const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Sleevy",
  providerIcon: "sleevy.png",
  description: "Connect your Sleevy account",
})

const auth = await client.authorizationRequest({
  endpoint: "https://sleevy.app/connect",
  clientId: "raycast",
  scope: "saved-items:capture saved-items:read account:read",
  extraParameters: { client: "raycast" },
})

const { authorizationCode } = await client.authorize(auth)
const res = await fetch("https://api.sleevy.app/connect/exchange", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ client: "raycast", code: authorizationCode, code_verifier: auth.codeVerifier }),
})
const { apiKey } = await res.json()
await client.setTokens({ accessToken: apiKey })
```

## Decisions

1. **Label autofill: yes.** Clients send a `device_hint` query param ("Chrome on macOS", "Onno's MacBook Pro"). Consent screen pre-fills an editable text field with it.
2. **Legacy keys: backfill scopes, no grandfathering.** One-time data migration assigns the full v1 scope set to every existing `apiKey` row. After migration, `permissions = null` means zero scopes (deny). Future scopes never retroactively apply.
3. **Sign-in resume: bounce.** Signed-out users hitting `/connect` redirect through `/sign-in?redirect=…` and resume after auth. Inline form rejected — too much going on already on the consent screen.
4. **Exchange rate limit: 10/min per IP, fail-closed.** Uses the existing Redis limiter from [ADR-0011](adr/0011-redis-for-api-key-rate-limits.md). Cheap insurance against nuisance.

## Implementation plan

Six slices, each independently mergeable behind a feature flag (`features.connectFlow`) until the Chrome and Raycast surfaces are ready.

### 1. Foundation: scopes + migration + middleware

- Add the v1 scope vocabulary as a typed constant in [apps/api/src/modules/auth](../apps/api/src/modules/auth) (`Scopes.ts`).
- Drizzle migration: backfill `apiKey.permissions` for every existing row with the full v1 scope set. Idempotent — re-running is a no-op.
- Scope-enforcement helper that the route handlers in [ApiHandlers.ts](../apps/api/src/api/ApiHandlers.ts) wrap each endpoint with. Reads `key.permissions`, returns 403 with `WWW-Authenticate: Bearer scope="…"` on mismatch.
- Tag each existing route in [ApiContract.ts](../apps/api/src/api/ApiContract.ts) with its required scope. No new behavior for clients that already have keys — they're backfilled with everything.

**Verification:** existing iOS + Chrome capture flows keep working in the dev environment; a manually-nulled `permissions` row returns 403.

### 2. Connect endpoints

- New `ConnectModule` under [apps/api/src/modules](../apps/api/src/modules) with the `connect_code` table (Drizzle schema + migration), `POST /connect/authorize`, and `POST /connect/exchange`.
- Client registry: hardcoded map `{ "chrome-extension": { redirectUris: ["https://<ext-id>.chromiumapp.org/"], defaultScopes: […] }, "raycast": { … } }`. Lives in module config; not in DB.
- PKCE verifier in ~10 lines (`base64url(sha256(verifier)) === challenge`).
- Wire the 10/min per-IP rate limit on `/connect/exchange` via the Redis limiter from [ADR-0011](adr/0011-redis-for-api-key-rate-limits.md).
- Mint via `auth.api.createApiKey({ userId, name: label, permissions, metadata: { client, deviceHint } })`.

**Verification:** curl-driven test that walks the full sequence end-to-end against a local API + Postgres + Redis.

### 3. Web `/connect` consent screen

- New route at [apps/web/src/routes/_app/connect.tsx](../apps/web/src/routes/_app/connect.tsx) (`_app` layout so it inherits the signed-in guard; signed-out users bounce through `/sign-in?redirect=…`).
- Reads `client`, `redirect_uri`, `code_challenge`, `scopes`, `state`, `device_hint` from search params.
- Renders client name + logo, editable label field pre-filled from `device_hint`, scope checkboxes (default-checked from the client's `defaultScopes`), Approve / Cancel.
- Approve → `POST /connect/authorize` → server returns `{ code }` → web does `window.location = redirect_uri + "#code=…&state=…"`.
- Cancel → redirect with `#error=access_denied&state=…`.

**Verification:** browser preview, walk through with a fake client that just `console.log`s the callback.

### 4. Settings: Connected Apps + API Keys sections

- Extend [settings-page.tsx](../apps/web/src/pages/settings-page.tsx) with two new `<section>` blocks.
- API client method to list keys, partitioned in the UI by `metadata.client`.
- **Connected Apps:** grouped headers for Raycast and Google Chrome with logos, per-row Disconnect, empty-state CTA per client.
- **API Keys:** flat list, name + last-used + scope chips + Revoke.
- All actions call BetterAuth's `apiKey.list` / `apiKey.delete` via the existing auth handler.

**Verification:** browser preview, create a key via dev tools, confirm it shows under the right section, revoke removes it.

### 5. Chrome extension: Connect button

- Replace the API-key textbox in [options.html](../apps/chrome-extension/src/options.html) + [options.ts](../apps/chrome-extension/src/options.ts) with a "Connect to Sleevy" button + status row.
- Implement the PKCE + `chrome.identity.launchWebAuthFlow` glue in a new `connect.ts` helper.
- Keep raw key entry behind a collapsed "Advanced" disclosure for one release, then remove.
- On success: store `{ apiKey, scopes, label }` in `chrome.storage.local` (drop the legacy single-`apiKey` shape behind a one-time migration).

**Verification:** load unpacked extension, click Connect, complete flow in dev, capture a page, see the saved item.

### 6. Raycast plugin: Connect

- New command "Connect Sleevy" in `apps/raycast-plugin` using `OAuth.PKCEClient` with `RedirectMethod.Web`.
- `device_hint` from `os.hostname()`.
- Store via `client.setTokens({ accessToken: apiKey })`; existing commands read it through `getAccessToken()`.
- Strip any existing manual-key preference once this lands.

**Verification:** `npm run dev` in Raycast, run Connect, confirm a capture command works against staging.

### Cross-cutting

- Add `features.connectFlow` config flag in [apps/api/src/runtime/Config.ts](../apps/api/src/runtime/Config.ts); endpoints + web route 404 when off. Lets slices 1–4 land before clients are ready.
- Update OpenAPI generation so the new endpoints + scope-required tags surface in the API Reference.
- Smoke test in CI that walks the full sequence with a stub client.
