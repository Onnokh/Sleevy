import { apiKey } from "@better-auth/api-key"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth"
import { bearer } from "better-auth/plugins"
import { Context, Effect, Layer } from "effect"

import { AppConfig } from "../../runtime/Config.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import { schema } from "../persistence/schema.js"

const bearerCredential = (authorization: string | null | undefined) =>
  authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null

const isSignedSessionToken = (credential: string) => credential.includes(".")

export class BetterAuth extends Context.Service<BetterAuth>()(
  "@app/modules/auth/BetterAuth",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig
      const { authDb } = yield* PostgresClient

      const auth = betterAuth({
        database: drizzleAdapter(authDb, {
          provider: "pg",
          schema,
        }),
        secret: config.auth.secret,
        baseURL: config.auth.baseUrl,
        trustedOrigins: [...config.auth.trustedOrigins],
        socialProviders: {
          google: {
            clientId: config.auth.googleClientId,
            clientSecret: config.auth.googleClientSecret,
          },
        },
        plugins: [
          bearer(),
          apiKey({
            customAPIKeyGetter: (ctx) => {
              const credential = bearerCredential(ctx.headers?.get("authorization"))
              if (!credential || isSignedSessionToken(credential)) {
                return null
              }

              return credential
            },
            enableSessionForAPIKeys: true,
            // Plugin-level rate limiting off; revisit when we have real traffic data.
            rateLimit: { enabled: false },
          }),
        ],
      })

      return {
        auth,
        handler: auth.handler,
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(BetterAuth, BetterAuth.make)
}
