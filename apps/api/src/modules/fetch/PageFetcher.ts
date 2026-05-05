import { Context, Data, Effect, Layer, Option, Result, Schema } from "effect"
import { chromium } from "playwright"

import { AppConfig } from "../../runtime/Config.js"

export class PageDocument extends Schema.Class<PageDocument>("PageDocument")({
  requestedUrl: Schema.String,
  finalUrl: Schema.String,
  html: Schema.String,
  documentTitle: Schema.optional(Schema.String),
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

const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

const resolveBrowserUserAgent = (configuredUserAgent: string) =>
  configuredUserAgent.includes("saved-items/")
    ? DEFAULT_BROWSER_USER_AGENT
    : configuredUserAgent

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim()

const parseAttributes = (tag: string): Record<string, string> => {
  const attributes: Record<string, string> = {}

  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(['"])(.*?)\2/gs)) {
    attributes[match[1]!.toLowerCase()] = normalizeText(match[3]!)
  }

  return attributes
}

const findMetaContent = (html: string, keys: readonly string[]) => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0])
    const key = (attributes.property ?? attributes.name)?.toLowerCase()

    if (key && normalizedKeys.has(key) && attributes.content) {
      return attributes.content
    }
  }
}

const findTitle = (html: string) => {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1] ? normalizeText(match[1]) : undefined
}

const lowConfidenceTitlePatterns: ReadonlyArray<RegExp> = [
  /^blocked$/i,
  /^access denied$/i,
  /^just a moment/i,
  /^attention required/i,
  /^are you a robot/i,
  /^please wait/i,
  /^security check/i,
  /^captcha/i,
]

const normalizeHostname = (rawUrl: string) => {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return undefined
  }
}

const isDomainLikeTitle = (title: string) =>
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(title)

const isLowConfidenceTitle = (
  title: string,
  comparisonUrls: ReadonlyArray<string>,
) => {
  const normalizedTitle = normalizeText(title).toLowerCase()
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
  const candidateTitle =
    page.documentTitle ??
    findMetaContent(page.html, ["og:title", "twitter:title"]) ??
    findTitle(page.html)

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

        const html = await response.text()

        return Option.some(
          new PageDocument({
            requestedUrl: url,
            finalUrl: response.url || url,
            html,
            documentTitle:
              findMetaContent(html, ["og:title", "twitter:title"]) ??
              findTitle(html),
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

const fetchViaBrowser = (
  url: string,
  config: {
    readonly browserTimeoutMs: number
    readonly browserHeadless: boolean
    readonly userAgent: string
  },
) =>
  Effect.tryPromise({
    try: async () => {
      const browser = await chromium.launch({
        headless: config.browserHeadless,
        args: ["--disable-blink-features=AutomationControlled"],
      })

      try {
        const browserUserAgent = resolveBrowserUserAgent(config.userAgent)
        const context = await browser.newContext({
          userAgent: browserUserAgent,
          locale: "en-US",
          viewport: { width: 1365, height: 768 },
          isMobile: false,
          hasTouch: false,
        })

        try {
          await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", {
              get: () => undefined,
            })
          })
          const page = await context.newPage()
          await page.setExtraHTTPHeaders({
            "accept-language": "en-US,en;q=0.9",
          })
          page.setDefaultNavigationTimeout(config.browserTimeoutMs)
          page.setDefaultTimeout(config.browserTimeoutMs)

          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: config.browserTimeoutMs,
          })

          const initialUrl = page.url()
          await page
            .waitForURL(
              (nextUrl) => nextUrl.toString() !== initialUrl,
              { timeout: Math.min(5_000, config.browserTimeoutMs) },
            )
            .catch(() => undefined)
          await page.waitForLoadState("networkidle", {
            timeout: Math.min(3_000, config.browserTimeoutMs),
          }).catch(() => undefined)
          await page.waitForTimeout(1_000)

          const responseContentType = response?.headers()["content-type"]
          const documentContentType = await page
            .evaluate(() => document.contentType)
            .catch(() => undefined)
          const contentType = responseContentType ?? documentContentType ?? "text/html"

          if (!contentType.toLowerCase().includes("text/html")) {
            return Option.none<PageDocument>()
          }

          const html = await page.content()
          const documentTitle = normalizeText(await page.title()).trim() || undefined

          return Option.some(
            new PageDocument({
              requestedUrl: url,
              finalUrl: page.url(),
              html,
              documentTitle,
              contentType,
              fetchedAt: new Date(),
            }),
          )
        } finally {
          await context.close()
        }
      } finally {
        await browser.close()
      }
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
                shouldUseBrowserOnSuccessfulHttpFetch(url, httpResult.success)
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
