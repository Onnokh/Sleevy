import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http"

import { BetterAuth } from "../modules/auth/BetterAuth.js"
import { scopesToPermissions, type Scope } from "../modules/auth/Scopes.js"
import { ConnectCodeRepository } from "../modules/connect/ConnectCodeRepository.js"
import { getConnectClient } from "../modules/connect/ConnectClients.js"
import { verifyPkceS256 } from "../modules/connect/Pkce.js"
import { ConnectAuthorizeRateLimiter } from "../modules/rate-limit/ConnectAuthorizeRateLimiter.js"
import { ConnectExchangeRateLimiter } from "../modules/rate-limit/ConnectExchangeRateLimiter.js"
import {
  ConnectAuthorizeResponse,
  ConnectError,
  ConnectExchangeResponse,
  CurrentUser,
  RateLimitExceeded,
  sleevyApi,
} from "./ApiContract.js"

const fail = (code: ConnectError["code"], message: string) =>
  new ConnectError({ code, message })

const clientIp = (request: HttpServerRequest.HttpServerRequest): string => {
  const headers = request.headers as Record<string, string | undefined>
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return headers["x-real-ip"] ?? "unknown"
}

export const connectAuthorizeGroupLive = HttpApiBuilder.group(
  sleevyApi,
  "connect-authorize",
  (handlers) =>
    handlers.handle("authorize", ({ payload }) =>
      Effect.gen(function* () {
        const userId = yield* CurrentUser
        const limiter = yield* ConnectAuthorizeRateLimiter
        const result = yield* limiter.check(userId)
        if (!result.allowed) {
          return yield* new RateLimitExceeded({
            message: "Too many connect attempts. Try again shortly.",
          })
        }

        const client = getConnectClient(payload.client)
        if (!client) {
          return yield* fail("unknown_client", `Unknown client: ${payload.client}.`)
        }
        if (!client.allowsRedirectUri(payload.redirectUri)) {
          return yield* fail(
            "invalid_redirect_uri",
            `redirectUri is not allowed for ${client.id}.`,
          )
        }
        for (const scope of payload.scopes) {
          if (!client.allowedScopes.has(scope)) {
            return yield* fail(
              "invalid_scope",
              `Scope ${scope} is not allowed for ${client.id}.`,
            )
          }
        }

        const repo = yield* ConnectCodeRepository
        const code = yield* repo.create({
          userId,
          client: client.id,
          scopes: payload.scopes as ReadonlyArray<Scope>,
          label: payload.label,
          deviceHint: payload.deviceHint ?? null,
          codeChallenge: payload.codeChallenge,
          redirectUri: payload.redirectUri,
        }).pipe(Effect.orDie)

        return new ConnectAuthorizeResponse({ code })
      }),
    ),
)

export const connectExchangeGroupLive = HttpApiBuilder.group(
  sleevyApi,
  "connect-exchange",
  (handlers) =>
    handlers.handle("exchange", ({ payload }) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const limiter = yield* ConnectExchangeRateLimiter
        const result = yield* limiter.check(clientIp(request))
        if (!result.allowed) {
          return yield* new RateLimitExceeded({
            message: "Too many connect exchange attempts. Try again shortly.",
          })
        }

        const client = getConnectClient(payload.client)
        if (!client) {
          return yield* fail("unknown_client", `Unknown client: ${payload.client}.`)
        }

        const repo = yield* ConnectCodeRepository
        const consumed = yield* repo.consume(payload.code).pipe(Effect.orDie)
        if (Option.isNone(consumed)) {
          return yield* fail("invalid_code", "Code is unknown, expired, or already used.")
        }
        const record = consumed.value

        if (record.client !== client.id) {
          return yield* fail(
            "client_mismatch",
            "Code was issued for a different client.",
          )
        }
        if (!verifyPkceS256(payload.codeVerifier, record.codeChallenge)) {
          return yield* fail("invalid_verifier", "PKCE verifier does not match.")
        }

        const { auth } = yield* BetterAuth
        const created = yield* Effect.promise(() =>
          auth.api.createApiKey({
            body: {
              userId: record.userId,
              name: record.label,
              permissions: scopesToPermissions(record.scopes),
              metadata: {
                client: record.client,
                deviceHint: record.deviceHint,
              },
            },
          }),
        )

        yield* Effect.logInfo("Connect exchange completed", {
          client: record.client,
          label: record.label,
        })

        return new ConnectExchangeResponse({
          apiKey: created.key,
          scopes: record.scopes,
          label: record.label,
        })
      }),
    ),
)
