import { Data } from "effect"

import type { LinkId } from "../../domain/SavedItem.js"

export class LinkNotFound extends Data.TaggedError("LinkNotFound")<{
  readonly linkId: LinkId
}> {}
