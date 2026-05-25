import { Data } from "effect"

import type { FolderId } from "../../domain/SavedItem.js"

export class FolderReferenceNotFound extends Data.TaggedError("FolderReferenceNotFound")<{
  readonly folderId: FolderId
}> {}
