import { Effect } from "effect"

import { AppConfig } from "./Config.js"
import { appLayer } from "./AppLayer.js"
import { makeApiWebHandler } from "./HttpApp.js"

const program = Effect.gen(function* () {
  const config = yield* AppConfig
  const fetch = yield* makeApiWebHandler

  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port: config.http.port,
        fetch,
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
  return yield* Effect.never
})

export const main = program.pipe(Effect.provide(appLayer))
