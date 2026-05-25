import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { CaptureService } from "../modules/capture/CaptureService.js"
import type { FolderId } from "../domain/SavedItem.js"
import { EnrichmentWorkflow } from "../modules/enrichment/EnrichmentWorkflow.js"
import {
  CaptureCreated,
  CaptureUpdated,
  CurrentUser,
  FolderNotFoundError,
  InvalidUrlError,
  savedItemToDto,
  sleevyApi,
} from "./ApiContract.js"
import { gated } from "./AuthMiddleware.js"

export const capturesGroupLive = HttpApiBuilder.group(sleevyApi, "captures", (handlers) =>
  handlers.handle("capture", gated("saved-items:capture", ({ payload }) =>
    Effect.gen(function* () {
      const capture = yield* CaptureService
      const enrichment = yield* EnrichmentWorkflow
      const userId = yield* CurrentUser
      const result = yield* capture.capture(userId, payload.url, {
        ...(payload.sourceName !== undefined ? { sourceName: payload.sourceName } : {}),
        ...(payload.captureChannel !== undefined ? { captureChannel: payload.captureChannel } : {}),
        ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
        folderId: payload.folderId === null || payload.folderId === undefined
          ? null
          : payload.folderId as FolderId,
      }).pipe(
        Effect.catchTags({
          InvalidUrl: (error) =>
            Effect.fail(new InvalidUrlError({
              message: "Capture URL must be a valid HTTP or HTTPS URL.",
              url: error.url,
            })),
          FolderReferenceNotFound: (error) =>
            Effect.fail(new FolderNotFoundError({
              message: "Folder was not found.",
              folderId: error.folderId,
            })),
          EffectDrizzleQueryError: Effect.die,
          SqlError: Effect.die,
        }),
      )
      yield* Effect.logInfo(
        result.captureResult === "created" ? "Added bookmark" : "Updated bookmark",
        { host: result.savedItem.link.host },
      )
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
  )),
)
