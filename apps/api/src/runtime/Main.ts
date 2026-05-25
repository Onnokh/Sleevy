import { Effect, Schedule } from "effect"

import { ConnectCodeRepository } from "../modules/connect/ConnectCodeRepository.js"
import { appLayer } from "./AppLayer.js"
import { AppConfig } from "./Config.js"
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
      : `Sleevy API listening on ${server.url}`,
  )

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
