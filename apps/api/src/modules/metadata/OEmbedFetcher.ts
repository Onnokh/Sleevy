import { Context, Data, Effect, Layer, Option, Result } from "effect"

import { stripBrandSuffix } from "../../lib/brand-suffix.js"
import { decodeEntities } from "../../lib/html.js"
import { Metadata } from "./MetadataFetcher.js"

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Safari/605.1.15"

type ProviderMetadata = {
  readonly title: string
  readonly siteName?: string | undefined
  readonly imageUrl?: string | undefined
  readonly description?: string | undefined
}

type ProviderResolver = (url: string) => Promise<ProviderMetadata | undefined>

type Provider = {
  readonly name: string
  readonly pattern: RegExp
  readonly resolve: ProviderResolver
}

class OEmbedFetcherError extends Data.TaggedError("OEmbedFetcherError")<{
  readonly cause: unknown
}> {}

type OEmbedResponse = {
  title?: unknown
  author_name?: unknown
  thumbnail_url?: unknown
  provider_name?: unknown
  html?: unknown
}

const fetchJson = async <T>(url: string, userAgent?: string): Promise<T | undefined> => {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(userAgent ? { "user-agent": userAgent } : {}),
    },
    redirect: "follow",
  })
  if (!response.ok) return undefined
  return (await response.json()) as T
}

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined

const oEmbedResolver = (endpoint: string): ProviderResolver => async (url) => {
  const json = await fetchJson<OEmbedResponse>(
    `${endpoint}?url=${encodeURIComponent(url)}&format=json`,
  )
  if (!json) return undefined

  const title = asString(json.title)
  if (!title) return undefined

  return {
    title,
    siteName: asString(json.provider_name),
    imageUrl: asString(json.thumbnail_url),
  }
}

type FxTwitterResponse = {
  readonly code?: number
  readonly tweet?: {
    readonly text?: unknown
    readonly author?: {
      readonly name?: unknown
      readonly screen_name?: unknown
    }
    readonly media?: {
      readonly photos?: ReadonlyArray<{ readonly url?: unknown }>
      readonly videos?: ReadonlyArray<{ readonly thumbnail_url?: unknown }>
    }
  }
}

const twitterResolver: ProviderResolver = async (url) => {
  // publish.twitter.com/oembed was discontinued post-acquisition; fxtwitter
  // is a community-run proxy that mirrors the public tweet payload as JSON.
  const path = url.replace(/^https?:\/\/(www\.)?(twitter\.com|x\.com)/i, "")
  const json = await fetchJson<FxTwitterResponse>(`https://api.fxtwitter.com${path}`)
  const tweet = json?.tweet
  if (!tweet) return undefined

  const text = asString(tweet.text)
  const authorName = asString(tweet.author?.name)
  const handle = asString(tweet.author?.screen_name)
  const title = text ?? (authorName ? `Post by ${authorName}` : undefined)
  if (!title) return undefined

  const photo = tweet.media?.photos?.[0]?.url
  const videoThumb = tweet.media?.videos?.[0]?.thumbnail_url

  return {
    title,
    siteName: handle ? `@${handle}` : "X",
    imageUrl: asString(photo) ?? asString(videoThumb),
  }
}

type RedditListing = ReadonlyArray<{
  readonly data?: {
    readonly children?: ReadonlyArray<{
      readonly data?: {
        readonly title?: unknown
        readonly subreddit_name_prefixed?: unknown
        readonly thumbnail?: unknown
        readonly preview?: {
          readonly images?: ReadonlyArray<{
            readonly source?: { readonly url?: unknown }
          }>
        }
        readonly selftext?: unknown
      }
    }>
  }
}>

const isUsableThumbnail = (value: string | undefined) => {
  if (!value) return false
  if (!value.startsWith("http")) return false
  return !["self", "default", "nsfw", "spoiler", "image"].includes(value)
}

const redditResolver: ProviderResolver = async (url) => {
  // Resolve share URLs (/r/.../s/...) to canonical (/r/.../comments/...).
  const initial = await fetch(url, {
    headers: { "user-agent": BROWSER_USER_AGENT, accept: "text/html" },
    redirect: "follow",
  })
  if (!initial.ok) return undefined

  const canonical = (initial.url || url).split("?")[0]!
  const jsonUrl = canonical.endsWith("/")
    ? `${canonical.slice(0, -1)}.json`
    : `${canonical}.json`

  const listing = await fetchJson<RedditListing>(jsonUrl, BROWSER_USER_AGENT)
  const post = listing?.[0]?.data?.children?.[0]?.data
  if (!post) return undefined

  const title = asString(post.title)
  if (!title) return undefined

  const previewImage = asString(post.preview?.images?.[0]?.source?.url)
  const thumbnail = asString(post.thumbnail)
  const rawImage = isUsableThumbnail(previewImage)
    ? previewImage
    : isUsableThumbnail(thumbnail)
    ? thumbnail
    : undefined
  const imageUrl = rawImage ? decodeEntities(rawImage) : undefined

  return {
    title,
    siteName: asString(post.subreddit_name_prefixed) ?? "Reddit",
    imageUrl,
    description: asString(post.selftext),
  }
}

const PROVIDERS: ReadonlyArray<Provider> = [
  {
    name: "youtube",
    pattern: /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i,
    resolve: oEmbedResolver("https://www.youtube.com/oembed"),
  },
  {
    name: "vimeo",
    pattern: /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
    resolve: oEmbedResolver("https://vimeo.com/api/oembed.json"),
  },
  {
    name: "twitter",
    pattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^/]+\/status\//i,
    resolve: twitterResolver,
  },
  {
    name: "reddit",
    pattern: /^https?:\/\/(www\.|old\.|m\.)?reddit\.com\/r\/[^/]+\/(comments|s)\//i,
    resolve: redditResolver,
  },
]

const findProvider = (url: string): Provider | undefined =>
  PROVIDERS.find((provider) => provider.pattern.test(url))

export class OEmbedFetcher extends Context.Service<OEmbedFetcher>()(
  "@app/modules/metadata/OEmbedFetcher",
  {
    make: Effect.succeed({
      fetch: (url: string): Effect.Effect<Option.Option<Metadata>, never> => {
        const provider = findProvider(url)
        if (!provider) return Effect.succeed(Option.none())

        const resolveEffect = Effect.tryPromise({
          try: () => provider.resolve(url),
          catch: (cause) => new OEmbedFetcherError({ cause }),
        })

        return Effect.gen(function* () {
          const result = yield* Effect.all([resolveEffect], { mode: "result" }).pipe(
            Effect.map(([r]) => r),
          )

          if (Result.isFailure(result)) {
            yield* Effect.logDebug("provider metadata lookup failed", {
              provider: provider.name,
              url,
              cause: String(result.failure.cause),
            })
            return Option.none<Metadata>()
          }

          const fields = result.success
          if (!fields) return Option.none<Metadata>()

          return Option.some(
            new Metadata({
              url,
              title: stripBrandSuffix(fields.title, fields.siteName, url),
              description: fields.description,
              siteName: fields.siteName,
              imageUrl: fields.imageUrl,
            }),
          )
        })
      },
    }),
  },
) {
  static readonly layer = Layer.effect(OEmbedFetcher, OEmbedFetcher.make)
}
