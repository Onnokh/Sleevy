import { describe, expect, test } from "bun:test"
import { Effect } from "effect"

import {
  type RequestAuth,
  withApiKeyRateLimit,
} from "../../src/runtime/ApiRequestMiddleware.js"
import type { ApiKeyRateLimiterShape } from "../../src/modules/rate-limit/ApiKeyRateLimiter.js"

const apiKey = "sly_" + "a".repeat(61)

const makeAuth = (input: {
  readonly valid?: boolean | undefined
  readonly apiKeyId?: string | undefined
  readonly onVerify?: ((key: string) => void) | undefined
} = {}): RequestAuth => ({
  api: {
    getSession: async () => null,
    verifyApiKey: async ({ body }) => {
      input.onVerify?.(body.key)
      return {
        valid: input.valid ?? true,
        error: input.valid === false ? new Error("invalid") : null,
        key: input.apiKeyId ? { id: input.apiKeyId } : { id: "api-key-1" },
      }
    },
  },
})

const makeRateLimiter = (input: {
  readonly allowed: boolean
  readonly onCheck?: ((apiKeyId: string) => void) | undefined
}): ApiKeyRateLimiterShape => ({
  check: (apiKeyId) =>
    Effect.sync(() => {
      input.onCheck?.(apiKeyId)
      return {
        allowed: input.allowed,
        limit: 20,
        remaining: input.allowed ? 19 : 0,
        resetSeconds: 42,
      }
    }),
})

const okHandler = async () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })

describe("withApiKeyRateLimit", () => {
  test("passes through requests without bearer credentials", async () => {
    let verified = false
    let checked = false

    const response = await withApiKeyRateLimit(
      new Request("https://api.test/v1/saved-items"),
      makeAuth({ onVerify: () => { verified = true } }),
      makeRateLimiter({ allowed: true, onCheck: () => { checked = true } }),
      okHandler,
    )

    expect(response.status).toBe(200)
    expect(verified).toBe(false)
    expect(checked).toBe(false)
  })

  test("passes through signed session bearer tokens without API key verification", async () => {
    let verified = false

    const response = await withApiKeyRateLimit(
      new Request("https://api.test/v1/saved-items", {
        headers: { authorization: "Bearer header.payload.signature" },
      }),
      makeAuth({ onVerify: () => { verified = true } }),
      makeRateLimiter({ allowed: true }),
      okHandler,
    )

    expect(response.status).toBe(200)
    expect(verified).toBe(false)
  })

  test("adds rate-limit headers for valid API keys", async () => {
    const response = await withApiKeyRateLimit(
      new Request("https://api.test/v1/saved-items", {
        headers: { authorization: `Bearer ${apiKey}` },
      }),
      makeAuth({ apiKeyId: "api-key-42" }),
      makeRateLimiter({ allowed: true }),
      okHandler,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("ratelimit-limit")).toBe("20")
    expect(response.headers.get("ratelimit-remaining")).toBe("19")
    expect(response.headers.get("ratelimit-reset")).toBe("42")
    expect(response.headers.get("retry-after")).toBeNull()
  })

  test("passes through invalid API keys without rate-limit headers", async () => {
    let checked = false

    const response = await withApiKeyRateLimit(
      new Request("https://api.test/v1/saved-items", {
        headers: { authorization: `Bearer ${apiKey}` },
      }),
      makeAuth({ valid: false }),
      makeRateLimiter({ allowed: true, onCheck: () => { checked = true } }),
      okHandler,
    )

    expect(response.status).toBe(200)
    expect(checked).toBe(false)
    expect(response.headers.get("ratelimit-limit")).toBeNull()
  })

  test("returns the public 429 error shape when the API key is over limit", async () => {
    const response = await withApiKeyRateLimit(
      new Request("https://api.test/v1/saved-items", {
        headers: { authorization: `Bearer ${apiKey}` },
      }),
      makeAuth({ apiKeyId: "api-key-42" }),
      makeRateLimiter({ allowed: false }),
      okHandler,
    )

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("42")
    expect(await response.json()).toEqual({
      _tag: "RateLimitExceeded",
      message: "API key rate limit exceeded.",
    })
  })
})
