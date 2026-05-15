import { eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { PostgresClient } from "../persistence/PostgresClient.js"
import { user } from "../persistence/schema.js"
import { BetterAuth } from "./BetterAuth.js"

export class AuthHandler extends Context.Service<AuthHandler, {
  readonly handle: (request: Request) => Promise<Response>
}>()(
  "@app/modules/auth/AuthHandler",
  {
    make: Effect.gen(function* () {
      const { auth, handler } = yield* BetterAuth
      const { authDb } = yield* PostgresClient

      const deleteAccount = async (request: Request): Promise<Response> => {
        if (request.method !== "POST") {
          return new Response(null, { status: 405 })
        }

        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user?.id) {
          return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        await authDb.delete(user).where(eq(user.id, session.user.id))
        return Response.json({ success: true })
      }

      const handle = async (request: Request): Promise<Response> => {
        const url = new URL(request.url)
        if (url.pathname === "/api/auth/delete-account") {
          return deleteAccount(request)
        }
        return handler(request)
      }

      return { handle } as const
    }),
  },
) {
  static readonly layer = Layer.effect(AuthHandler, AuthHandler.make)
}
