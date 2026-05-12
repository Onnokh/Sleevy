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

        const userId = yield* Effect.tryPromise({
          try: async (): Promise<UserId> => {
            const session = await auth.api.getSession({ headers: webHeaders })
            if (session?.user?.id) {
              return session.user.id as UserId
            }
            throw new Error("missing")
          },
          catch: () => new Unauthorized({ message: "Missing or invalid credentials." }),
        })

        return yield* Effect.provideService(handler, CurrentUser, userId)
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
      const result = yield* capture.capture(userId, payload.url, {
        ...(payload.sourceName !== undefined ? { sourceName: payload.sourceName } : {}),
        ...(payload.captureChannel !== undefined ? { captureChannel: payload.captureChannel } : {}),
      }).pipe(
        Effect.catchTags({
          InvalidUrl: (error) => Effect.fail(new InvalidUrlError({ url: error.url })),
          EffectDrizzleQueryError: Effect.die,
          SqlError: Effect.die,
        }),
      )
      yield* Effect.logInfo("capture handled", {
        savedItemId: result.savedItem.savedItem.id,
        linkId: result.savedItem.link.id,
        captureResult: result.captureResult,
        host: result.savedItem.link.host,
      })
      yield* enrichment
        .enrich(result.savedItem.link.id)
        .pipe(
          Effect.annotateLogs({
            savedItemId: result.savedItem.savedItem.id,
            linkId: result.savedItem.link.id,
          }),
          Effect.ignore({ log: true }),
          Effect.forkDetach,
        )
      const savedItem = savedItemToDto(result.savedItem)
      return result.captureResult === "created"
        ? new CaptureCreated({ savedItem, captureResult: "created" })
        : new CaptureUpdated({ savedItem, captureResult: "updated" })
    }),
  ),
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
          return yield* new SavedItemNotFoundError({ savedItemId: params.id })
        }
        const updated = yield* repo.setReadState(params.id, true).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({ savedItemId: params.id })
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
          return yield* new SavedItemNotFoundError({ savedItemId: params.id })
        }
        const updated = yield* repo.setReadState(params.id, payload.isRead).pipe(Effect.orDie)
        if (updated._tag === "None") {
          return yield* new SavedItemNotFoundError({ savedItemId: params.id })
        }
        return savedItemToDto(updated.value)
      }),
    )
    .handle("remove", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        yield* repo.deleteByUserAndId(userId, params.id).pipe(Effect.orDie)
      }),
    ),
)

const groupLives = Layer.mergeAll(
  capturesGroupLive,
  savedItemsGroupLive,
)

export const sleevyApiHandlers = groupLives.pipe(Layer.provide(SessionOrApiKeyAuthLive))

export const sleevyApiLive = HttpApiBuilder.layer(sleevyApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(sleevyApiHandlers))
