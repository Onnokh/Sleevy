import { Effect } from "effect"

import type { ApiKeyRateLimiterShape, RateLimitResult } from "../modules/rate-limit/ApiKeyRateLimiter.js"

const API_KEY_LENGTH = 64

type SessionApi = {
  readonly getSession: (input: { readonly headers: Headers }) => Promise<{
    readonly session?: { readonly token?: string } | null
    readonly user?: { readonly id?: string } | null
  } | null>
}

type ApiKeyApi = {
  readonly verifyApiKey: (input: { readonly body: { readonly key: string } }) => Promise<{
    readonly valid: boolean
    readonly error: unknown
    readonly key: { readonly id?: string } | null
  }>
}

export type RequestAuth = {
  readonly api: SessionApi & ApiKeyApi
}

export const exposedApiResponseHeaders = [
  "set-auth-token",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
  "retry-after",
] as const

const extractBearer = (request: Request) =>
  request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]

const rateLimitHeaders = (result: RateLimitResult) =>
  new Headers({
    "ratelimit-limit": String(result.limit),
    "ratelimit-remaining": String(result.remaining),
    "ratelimit-reset": String(result.resetSeconds),
    ...(result.allowed ? {} : { "retry-after": String(result.resetSeconds) }),
  })

const rateLimitResponse = (result: RateLimitResult) =>
  new Response(
    JSON.stringify({
      _tag: "RateLimitExceeded",
      message: "API key rate limit exceeded.",
    }),
    {
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers({
        "content-type": "application/json",
        ...Object.fromEntries(rateLimitHeaders(result)),
      }),
    },
  )

export const withApiKeyRateLimit = async (
  request: Request,
  auth: RequestAuth,
  rateLimiter: ApiKeyRateLimiterShape,
  handle: (request: Request) => Promise<Response>,
) => {
  const bearer = extractBearer(request)
  if (!bearer) {
    return handle(request)
  }

  if (bearer.length < API_KEY_LENGTH) {
    return handle(request)
  }

  const verified = await auth.api.verifyApiKey({ body: { key: bearer } })
  const apiKeyId = verified.valid && verified.error === null ? verified.key?.id : undefined
  if (!apiKeyId) {
    return handle(request)
  }

  const limit = await Effect.runPromise(rateLimiter.check(apiKeyId))
  if (!limit.allowed) {
    return rateLimitResponse(limit)
  }

  const response = await handle(request)
  const headers = new Headers(response.headers)
  rateLimitHeaders(limit).forEach((value, key) => headers.set(key, value))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
