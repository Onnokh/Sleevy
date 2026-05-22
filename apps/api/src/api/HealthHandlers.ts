import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { HealthResponse, sleevyApi } from "./ApiContract.js"

export const healthGroupLive = HttpApiBuilder.group(sleevyApi, "health", (handlers) =>
  handlers
    .handle("check", () => Effect.succeed(new HealthResponse({ ok: true })))
    .handle("checkV1", () => Effect.succeed(new HealthResponse({ ok: true }))),
)
