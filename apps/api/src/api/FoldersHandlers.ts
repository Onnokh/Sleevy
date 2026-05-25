import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { FolderRepository } from "../modules/folders/FolderRepository.js"
import {
  CurrentUser,
  FolderDto,
  FolderNameConflictError,
  FolderNotFoundError,
  FoldersResponse,
  InvalidFolderNameError,
  sleevyApi,
} from "./ApiContract.js"
import { gated } from "./AuthMiddleware.js"

const toDto = (folder: { readonly id: string; readonly name: string }) =>
  new FolderDto({ id: folder.id, name: folder.name })

const validateName = (name: string) => {
  const normalized = name.trim()
  return normalized.length === 0 || normalized.length > 80
    ? Effect.fail(new InvalidFolderNameError({
        message: "Folder name must contain between 1 and 80 characters.",
      }))
    : Effect.succeed(normalized)
}

const notFound = (folderId: string) => new FolderNotFoundError({
  message: "Folder was not found.",
  folderId,
})

const conflict = () => new FolderNameConflictError({
  message: "A Folder with this name already exists.",
})

export const foldersGroupLive = HttpApiBuilder.group(sleevyApi, "folders", (handlers) =>
  handlers
    .handle("list", gated("folders:read", () =>
      Effect.gen(function* () {
        const repo = yield* FolderRepository
        const userId = yield* CurrentUser
        const folders = yield* repo.listByUser(userId).pipe(Effect.orDie)
        return new FoldersResponse({ folders: folders.map(toDto) })
      }),
    ))
    .handle("create", gated("folders:write", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* FolderRepository
        const userId = yield* CurrentUser
        const name = yield* validateName(payload.name)
        const existing = yield* repo.findByNormalizedName(userId, name).pipe(Effect.orDie)
        if (existing._tag === "Some") return yield* conflict()
        const created = yield* repo.create(userId, name).pipe(Effect.orDie)
        return created._tag === "Some" ? toDto(created.value) : yield* conflict()
      }),
    ))
    .handle("rename", gated("folders:write", ({ params, payload }) =>
      Effect.gen(function* () {
        const repo = yield* FolderRepository
        const userId = yield* CurrentUser
        const found = yield* repo.findByUserAndId(userId, params.id).pipe(Effect.orDie)
        if (found._tag === "None") return yield* notFound(params.id)
        const name = yield* validateName(payload.name)
        const existing = yield* repo.findByNormalizedName(userId, name, params.id).pipe(Effect.orDie)
        if (existing._tag === "Some") return yield* conflict()
        const updated = yield* repo.rename(userId, params.id, name).pipe(Effect.orDie)
        return updated._tag === "Some" ? toDto(updated.value) : yield* notFound(params.id)
      }),
    ))
    .handle("remove", gated("folders:delete", ({ params }) =>
      Effect.gen(function* () {
        const repo = yield* FolderRepository
        const userId = yield* CurrentUser
        const removed = yield* repo.deleteByUserAndId(userId, params.id).pipe(Effect.orDie)
        if (!removed) return yield* notFound(params.id)
        yield* Effect.logInfo("Deleted folder")
      }),
    )),
)
