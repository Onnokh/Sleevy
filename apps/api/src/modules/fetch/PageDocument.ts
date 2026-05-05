import { Data, Schema } from "effect"

export class PageDocument extends Schema.Class<PageDocument>("PageDocument")({
  requestedUrl: Schema.String,
  finalUrl: Schema.String,
  html: Schema.String,
  contentType: Schema.String,
  fetchedAt: Schema.Date,
}) {}

export class PageFetcherError extends Data.TaggedError("PageFetcherError")<{
  readonly operation: string
  readonly url: string
  readonly cause: unknown
}> {}