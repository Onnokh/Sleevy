import { Context, Data, Effect, Layer, Option, Schema } from "effect"

import { AppConfig } from "../../runtime/Config.js"

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

const fetchViaHttp = (
  url: string,
  config: {
    readonly timeoutMs: number
    readonly userAgent: string
  },
) =>
  Effect.tryPromise({
    try: async () => {
      const abortController = new AbortController()
      const timeout = setTimeout(() => abortController.abort(), config.timeoutMs)

      try {
        const response = await fetch(url, {
          headers: {
            "user-agent": config.userAgent,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "no-cache",
            pragma: "no-cache",
          },
          redirect: "follow",
          signal: abortController.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const contentType = response.headers.get("content-type") ?? ""

        if (!contentType.toLowerCase().includes("text/html")) {
          return Option.none<PageDocument>()
        }

        return Option.some(
          new PageDocument({
            requestedUrl: url,
            finalUrl: response.url || url,
            html: await response.text(),
            contentType,
            fetchedAt: new Date(),
          }),
        )
      } finally {
        clearTimeout(timeout)
      }
    },
    catch: (cause) =>
      new PageFetcherError({
        operation: "fetch",
        url,
        cause,
      }),
  })

export class PageFetcher extends Context.Service<PageFetcher>()(
  "@app/modules/fetch/PageFetcher",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig

      return {
        fetch: (url: string) => fetchViaHttp(url, config.fetch),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(PageFetcher, PageFetcher.make)
}
