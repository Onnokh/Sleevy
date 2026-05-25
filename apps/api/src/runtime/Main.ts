import { Effect, Layer, Schedule } from "effect"
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http"

import { sleevyApiLive } from "../api/ApiHandlers.js"
import { AuthHandler } from "../modules/auth/AuthHandler.js"
import { BetterAuth } from "../modules/auth/BetterAuth.js"
import { CaptureService } from "../modules/capture/CaptureService.js"
import { EnrichmentWorkflow } from "../modules/enrichment/EnrichmentWorkflow.js"
import { ConnectCodeRepository } from "../modules/connect/ConnectCodeRepository.js"
import { ApiKeyRateLimiter } from "../modules/rate-limit/ApiKeyRateLimiter.js"
import { ConnectAuthorizeRateLimiter } from "../modules/rate-limit/ConnectAuthorizeRateLimiter.js"
import { ConnectExchangeRateLimiter } from "../modules/rate-limit/ConnectExchangeRateLimiter.js"
import { SavedItemRepository } from "../modules/saved-items/SavedItemRepository.js"
import { FolderRepository } from "../modules/folders/FolderRepository.js"
import {
  exposedApiResponseHeaders,
  withApiKeyRateLimit,
} from "./ApiRequestMiddleware.js"
import { AppConfig } from "./Config.js"
import { appLayer } from "./AppLayer.js"

const httpAppLayer = sleevyApiLive.pipe(
  Layer.provide(appLayer),
  Layer.provide(HttpServer.layerServices),
)

const corsHeaders = (request: Request, trustedOrigins: readonly string[]) => {
  const origin = request.headers.get("origin")
  const headers = new Headers({
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": exposedApiResponseHeaders.join(", "),
    vary: "Origin",
  })

  if (origin && trustedOrigins.includes(origin)) {
    headers.set("access-control-allow-origin", origin)
  }

  return headers
}

const setCookieHeaders = (headers: Headers) =>
  typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : []

const withCors = async (
  request: Request,
  trustedOrigins: readonly string[],
  handle: (request: Request) => Promise<Response>,
) => {
  const headersToAdd = corsHeaders(request, trustedOrigins)

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headersToAdd })
  }

  const response = await handle(request)
  const cookies = setCookieHeaders(response.headers)
  const headers = new Headers(response.headers)
  headers.delete("set-cookie")
  headersToAdd.forEach((value, key) => headers.set(key, value))
  cookies.forEach((cookie) => headers.append("set-cookie", cookie))

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const program = Effect.gen(function* () {
  const config = yield* AppConfig
  const context = yield* Effect.context<
    AuthHandler | BetterAuth | CaptureService | EnrichmentWorkflow | SavedItemRepository | FolderRepository | ApiKeyRateLimiter | ConnectCodeRepository | ConnectAuthorizeRateLimiter | ConnectExchangeRateLimiter
  >()
  const authHandler = yield* AuthHandler
  const { auth } = yield* BetterAuth
  const rateLimiter = yield* ApiKeyRateLimiter
  const httpEffect = yield* HttpRouter.toHttpEffect(httpAppLayer)
  const apiFetch = HttpEffect.toWebHandler(Effect.provideContext(httpEffect, context))

  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port: config.http.port,
        fetch: (request) =>
          withCors(
            request,
            config.auth.trustedOrigins,
            new URL(request.url).pathname.startsWith("/api/auth/")
              ? authHandler.handle
              : (request) =>
                  withApiKeyRateLimit(request, auth, rateLimiter, apiFetch),
          ),
      }),
    ),
    (server) => Effect.promise(() => server.stop()),
  )

  const portlessUrl = process.env.PORTLESS_URL
  yield* Effect.log(
    portlessUrl
      ? `Sleevy API listening on ${portlessUrl} (portless)`
      : `Sleevy API listening on ${server.url}`
  )

  // Background sweep of expired / consumed connect codes. Hourly, fail-tolerant.
  const connectCodes = yield* ConnectCodeRepository
  yield* connectCodes
    .cleanupExpired()
    .pipe(
      Effect.ignore({ log: true }),
      Effect.repeat(Schedule.spaced("1 hour")),
      Effect.forkDetach,
    )

  return yield* Effect.never
})

export const main = program.pipe(Effect.provide(appLayer))
