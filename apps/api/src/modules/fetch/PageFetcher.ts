import { spawn } from "node:child_process"

import { Context, Data, Effect, Layer, Option, Result, Schema } from "effect"

import { getMetaContent, getTitle, parseHtml } from "../../lib/html.js"
import { normalizeHostname } from "../../lib/url.js"
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

const isBlockedFetchError = (error: PageFetcherError) => {
  const message =
    error.cause instanceof Error ? error.cause.message : String(error.cause)

  return /\bHTTP (403|429)\b/.test(message)
}

const lowConfidenceTitlePatterns: ReadonlyArray<RegExp> = [
  /^blocked$/i,
  /^access denied$/i,
  /just a moment/i,
  /attention required/i,
  /are you a robot/i,
  /please wait/i,
  /security check/i,
  /verification/i,
  /verify you are human/i,
  /checking your browser/i,
  /captcha/i,
]

const isDomainLikeTitle = (title: string) =>
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(title)

const isLowConfidenceTitle = (
  title: string,
  comparisonUrls: ReadonlyArray<string>,
) => {
  const normalizedTitle = title.replace(/\s+/g, " ").trim().toLowerCase()
  if (!normalizedTitle) {
    return true
  }

  if (normalizedTitle.length < 3) {
    return true
  }

  if (lowConfidenceTitlePatterns.some((pattern) => pattern.test(normalizedTitle))) {
    return true
  }

  const hostnames = comparisonUrls
    .map((url) => normalizeHostname(url))
    .filter((hostname): hostname is string => hostname !== undefined)

  if (hostnames.some((hostname) => normalizedTitle === hostname)) {
    return true
  }

  if (isDomainLikeTitle(normalizedTitle)) {
    return true
  }

  return false
}

const shouldUseBrowserOnSuccessfulHttpFetch = (
  requestedUrl: string,
  page: PageDocument,
) => {
  const document = parseHtml(page.html)
  const candidateTitle =
    getMetaContent(document, ["og:title", "twitter:title"]) ?? getTitle(document)

  if (!candidateTitle) {
    return true
  }

  return isLowConfidenceTitle(candidateTitle, [
    requestedUrl,
    page.requestedUrl,
    page.finalUrl,
  ])
}

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

const runLightpanda = (url: string, timeoutMs: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "lightpanda",
      ["fetch", "--dump", "html", "--wait-until", "domcontentloaded", url],
      { stdio: ["ignore", "pipe", "pipe"] },
    )

    let stdout = ""
    let stderr = ""
    let settled = false

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const killTimer = setTimeout(() => {
      child.kill("SIGKILL")
      settle(() =>
        reject(new Error(`Lightpanda timed out after ${timeoutMs}ms`)),
      )
    }, timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      clearTimeout(killTimer)
      settle(() => reject(error))
    })

    // Lightpanda dumps HTML before tearing down — non-zero exit codes
    // (e.g. SIGSEGV during shutdown on JS-heavy pages) are tolerable
    // as long as we captured a document.
    child.on("close", (code) => {
      clearTimeout(killTimer)
      if (stdout.length > 0) {
        settle(() => resolve(stdout))
      } else {
        const trimmed = stderr.trim() || `exit code ${code}`
        settle(() => reject(new Error(`Lightpanda failed: ${trimmed}`)))
      }
    })
  })

const fetchViaBrowser = (
  url: string,
  config: {
    readonly browserTimeoutMs: number
  },
) =>
  Effect.tryPromise({
    try: async () => {
      const html = await runLightpanda(url, config.browserTimeoutMs)

      if (html.trim().length === 0) {
        throw new Error("Lightpanda returned empty document")
      }

      return Option.some(
        new PageDocument({
          requestedUrl: url,
          finalUrl: url,
          html,
          contentType: "text/html",
          fetchedAt: new Date(),
        }),
      )
    },
    catch: (cause) =>
      new PageFetcherError({
        operation: "browser-fetch",
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
        fetch: (url: string) =>
          Effect.gen(function* () {
            const httpResult = yield* Effect.all([fetchViaHttp(url, config.fetch)], {
              mode: "result",
            }).pipe(Effect.map(([result]) => result))

            if (!config.fetch.browserFallbackEnabled) {
              if (Result.isSuccess(httpResult)) {
                return httpResult.success
              }

              return yield* httpResult.failure
            }

            if (Result.isSuccess(httpResult)) {
              if (
                Option.isSome(httpResult.success) &&
                shouldUseBrowserOnSuccessfulHttpFetch(url, httpResult.success.value)
              ) {
                const browserResult = yield* fetchViaBrowser(url, config.fetch).pipe(
                  (effect) => Effect.all([effect], { mode: "result" }).pipe(Effect.map(([result]) => result)),
                )

                if (Result.isSuccess(browserResult)) {
                  return browserResult.success
                }
              }

              return httpResult.success
            }

            if (!isBlockedFetchError(httpResult.failure)) {
              return yield* httpResult.failure
            }

            const browserResult = yield* fetchViaBrowser(url, config.fetch).pipe(
              (effect) => Effect.all([effect], { mode: "result" }).pipe(Effect.map(([result]) => result)),
            )

            if (Result.isSuccess(browserResult)) {
              return browserResult.success
            }

            return yield* new PageFetcherError({
              operation: "fetch-with-browser-fallback",
              url,
              cause: new Error(
                [
                  `HTTP fetch failed: ${String(httpResult.failure.cause)}`,
                  `Browser fallback failed: ${String(browserResult.failure.cause)}`,
                ].join(" | "),
              ),
            })
          }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(PageFetcher, PageFetcher.make)
}
