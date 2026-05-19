import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http"

import type { UserId } from "../domain/SavedItem.js"
import { BetterAuth } from "../modules/auth/BetterAuth.js"
import { CaptureService } from "../modules/capture/CaptureService.js"
import { EnrichmentWorkflow } from "../modules/enrichment/EnrichmentWorkflow.js"
import { SavedItemRepository } from "../modules/saved-items/SavedItemRepository.js"
import {
  CaptureCreated,
  CaptureUpdated,
  CurrentUser,
  HealthResponse,
  InvalidUrlError,
  SavedItemNotFoundError,
  SavedItemsResponse,
  SessionOrApiKeyAuth,
  Unauthorized,
  sleevyApi,
  savedItemToDto,
} from "./ApiContract.js"

export const SessionOrApiKeyAuthLive = Layer.effect(SessionOrApiKeyAuth)(
  Effect.gen(function* () {
    const { auth } = yield* BetterAuth

    return SessionOrApiKeyAuth.of((handler) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const webHeaders = new Headers(request.headers as Record<string, string>)

        const { userId, userEmail } = yield* Effect.tryPromise({
          try: async () => {
            const session = await auth.api.getSession({ headers: webHeaders })
            if (session?.user?.id) {
              return { userId: session.user.id as UserId, userEmail: session.user.email }
            }
            throw new Error("missing")
          },
          catch: () => new Unauthorized({ message: "Missing or invalid credentials." }),
        })

        return yield* handler.pipe(
          Effect.provideService(CurrentUser, userId),
          Effect.annotateLogs({ user: userEmail }),
        )
      }),
    )
  }),
)

const capturesGroupLive = HttpApiBuilder.group(sleevyApi, "captures", (handlers) =>
  handlers.handle("capture", ({ payload }) =>
    Effect.gen(function* () {
      const capture = yield* CaptureService
      const enrichment = yield* EnrichmentWorkflow
      const userId = yield* CurrentUser
      const result = yield* capture.capture({
        userId,
        url: payload.url,
        ...(payload.sourceName !== undefined ? { sourceName: payload.sourceName } : {}),
        ...(payload.captureChannel !== undefined ? { captureChannel: payload.captureChannel } : {}),
        ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
      }).pipe(
        Effect.catchTags({
          InvalidUrl: (error) =>
            Effect.fail(new InvalidUrlError({
              message: "Capture URL must be a valid HTTP or HTTPS URL.",
              url: error.url,
            })),
          EffectDrizzleQueryError: Effect.die,
          SqlError: Effect.die,
        }),
      )
      yield* Effect.logInfo(
        result.captureResult === "created" ? "Added bookmark" : "Updated bookmark",
        { host: result.savedItem.link.host },
      )
      if (result.enrichment._tag === "start") {
        yield* enrichment
          .enrich(result.enrichment.linkId)
          .pipe(
            Effect.annotateLogs({
              savedItemId: result.savedItem.savedItem.id,
              linkId: result.enrichment.linkId,
            }),
            Effect.ignore({ log: true }),
            Effect.forkDetach,
          )
      }
      const savedItem = savedItemToDto(result.savedItem)
      return result.captureResult === "created"
        ? new CaptureCreated({ savedItem, captureResult: "created" })
        : new CaptureUpdated({ savedItem, captureResult: "updated" })
    }),
  ),
)

const healthGroupLive = HttpApiBuilder.group(sleevyApi, "health", (handlers) =>
  handlers
    .handle("check", () => Effect.succeed(new HealthResponse({ ok: true })))
    .handle("checkV1", () => Effect.succeed(new HealthResponse({ ok: true }))),
)

const savedItemsGroupLive = HttpApiBuilder.group(sleevyApi, "saved-items", (handlers) =>
  handlers
    .handle("list", ({ query }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        const items = yield* repo.listByUser(userId, query.sort ?? "newest").pipe(Effect.orDie)
        return new SavedItemsResponse({ savedItems: items.map(savedItemToDto) })
      }),
    )
    .handle("markOpened", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        const item = yield* repo.findByUserAndId(userId, params.id).pipe(Effect.orDie)
        if (item._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        const updated = yield* repo.setReadState(params.id, true).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        return savedItemToDto(updated.value)
      }),
    )
    .handle("setReadState", ({ params, payload }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        const item = yield* repo.findByUserAndId(userId, params.id).pipe(Effect.orDie)
        if (item._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        const updated = yield* repo.setReadState(params.id, payload.isRead).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({
            message: "Saved Item was not found.",
            savedItemId: params.id,
          })
        }
        return savedItemToDto(updated.value)
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        yield* repo.deleteByUserAndId(userId, params.id).pipe(Effect.orDie)
        yield* Effect.logInfo("Deleted bookmark")
      }),
    ),
)

const groupLives = Layer.mergeAll(
  healthGroupLive,
  capturesGroupLive,
  savedItemsGroupLive,
)

export const sleevyApiHandlers = groupLives.pipe(Layer.provide(SessionOrApiKeyAuthLive))

export const sleevyApiLive = HttpApiBuilder.layer(sleevyApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(sleevyApiHandlers))
