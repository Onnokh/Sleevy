import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import type { SavedItemId } from "../domain/SavedItem.js"
import { SavedItemRepository } from "../modules/saved-items/SavedItemRepository.js"
import {
  CurrentUser,
  SavedItemNotFoundError,
  SavedItemsResponse,
  savedItemToDto,
  sleevyApi,
} from "./ApiContract.js"
import { gated } from "./AuthMiddleware.js"

const setSavedItemReadState = (id: SavedItemId, isRead: boolean) =>
  Effect.gen(function* () {
    const repo = yield* SavedItemRepository
    const userId = yield* CurrentUser
    const item = yield* repo.findByUserAndId(userId, id).pipe(Effect.orDie)
    if (item._tag === "None") {
      return yield* new SavedItemNotFoundError({
        message: "Saved Item was not found.",
        savedItemId: id,
      })
    }
    const updated = yield* repo.setReadState(id, isRead).pipe(Effect.orDie)
    if (updated._tag === "None") {
      return yield* new SavedItemNotFoundError({
        message: "Saved Item was not found.",
        savedItemId: id,
      })
    }
    return savedItemToDto(updated.value)
  })

export const savedItemsGroupLive = HttpApiBuilder.group(sleevyApi, "saved-items", (handlers) =>
  handlers
    .handle("list", gated("saved-items:read", ({ query }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        const items = yield* repo.listByUser(userId, query.sort ?? "newest").pipe(Effect.orDie)
        return new SavedItemsResponse({ savedItems: items.map(savedItemToDto) })
      }),
    ))
    .handle("markOpened", gated("saved-items:write", ({ params }) =>
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
    ))
    .handle("markRead", gated("saved-items:write", ({ params }) => setSavedItemReadState(params.id, true)))
    .handle("markUnread", gated("saved-items:write", ({ params }) => setSavedItemReadState(params.id, false)))
    .handle("setReadState", gated("saved-items:write", ({ params, payload }) => setSavedItemReadState(params.id, payload.isRead)))
    .handle("remove", gated("saved-items:delete", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* SavedItemRepository
        const userId = yield* CurrentUser
        yield* repo.deleteByUserAndId(userId, params.id).pipe(Effect.orDie)
        yield* Effect.logInfo("Deleted bookmark")
      }),
    )),
)
