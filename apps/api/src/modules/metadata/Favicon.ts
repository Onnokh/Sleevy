import { type HtmlDocument } from "../../lib/html.js"
import { toAbsoluteUrl } from "../../lib/url.js"

export type PreferredColorScheme = "light" | "dark"

export type FaviconCandidate = {
  readonly url: string
  readonly rel: string
  readonly media?: string | undefined
  readonly type?: string | undefined
  readonly sizes?: string | undefined
  /**
   * For SVG icons that support theme variants (e.g., GitHub's data-base-href pattern),
   * this contains the base URL without the extension, allowing construction of
   * -dark.svg and -light.svg variants.
   */
  readonly baseHref?: string | undefined
}

export const findFaviconCandidates = (
  document: HtmlDocument,
  baseUrl: string,
): ReadonlyArray<FaviconCandidate> => {
  const candidates: Array<FaviconCandidate> = []

  for (const link of document.querySelectorAll("link[rel]")) {
    const rel = (link.getAttribute("rel") ?? "").toLowerCase()
    if (!rel) continue

    const relValues = rel.split(/\s+/).filter(Boolean)
    const isStandardIcon = relValues.includes("icon")
    const isAppleTouchIcon = rel.startsWith("apple-touch-icon")
    const isMaskIcon = relValues.includes("mask-icon")

    if ((!isStandardIcon && !isAppleTouchIcon) || isMaskIcon) continue

    const url = toAbsoluteUrl(link.getAttribute("href") ?? undefined, baseUrl)
    if (!url) continue

    const type = link.getAttribute("type")?.toLowerCase() ?? undefined
    const isSvg = type === "image/svg+xml" || url.toLowerCase().endsWith(".svg")
    const baseHref = isSvg
      ? link.getAttribute("data-base-href") ?? undefined
      : undefined

    candidates.push({
      url,
      rel,
      media: link.getAttribute("media")?.toLowerCase() ?? undefined,
      type,
      sizes: link.getAttribute("sizes")?.toLowerCase() ?? undefined,
      baseHref,
    })

    // For SVG icons with a base-href, generate dark variant candidate
    // This handles GitHub's pattern where favicon-dark.svg is the light icon for dark mode
    if (baseHref) {
      const darkVariantUrl = `${baseHref}-dark.svg`
      if (darkVariantUrl !== url) {
        candidates.push({
          url: darkVariantUrl,
          rel,
          media: "(prefers-color-scheme: dark)",
          type: "image/svg+xml",
          sizes: undefined,
          baseHref,
        })
      }
    }
  }

  return candidates
}

const parseMediaColorScheme = (
  media: string | undefined,
): PreferredColorScheme | undefined => {
  if (!media) return undefined
  const normalized = media.toLowerCase()
  if (!normalized.includes("prefers-color-scheme")) return undefined
  if (normalized.includes("dark")) return "dark"
  if (normalized.includes("light")) return "light"
}

const parseLargestIconSize = (sizes: string | undefined) => {
  if (!sizes || sizes === "any") return 0

  let largest = 0
  for (const size of sizes.split(/\s+/)) {
    const match = size.match(/^(\d+)x(\d+)$/)
    if (!match) continue
    const width = Number.parseInt(match[1]!, 10)
    const height = Number.parseInt(match[2]!, 10)
    largest = Math.max(largest, width, height)
  }
  return largest
}

const inferIconType = (candidate: FaviconCandidate) => {
  if (candidate.type) return candidate.type

  try {
    const pathname = new URL(candidate.url).pathname.toLowerCase()
    if (pathname.endsWith(".png")) return "image/png"
    if (pathname.endsWith(".ico")) return "image/x-icon"
    if (pathname.endsWith(".svg")) return "image/svg+xml"
    if (pathname.endsWith(".gif")) return "image/gif"
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg"
    if (pathname.endsWith(".webp")) return "image/webp"
  } catch {
    return
  }
}

const iconTypeScore = (candidate: FaviconCandidate) => {
  const type = inferIconType(candidate)

  switch (type) {
    case "image/png":
      return 8
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return 7
    case "image/webp":
    case "image/gif":
    case "image/jpeg":
      return 6
    case "image/svg+xml":
      return 2
    default:
      return 4
  }
}

const mediaScore = (
  candidate: FaviconCandidate,
  scheme: PreferredColorScheme | undefined,
) => {
  const candidateScheme = parseMediaColorScheme(candidate.media)

  if (!scheme) {
    if (!candidate.media || candidateScheme === undefined) return 30
    return candidateScheme === "light" ? 20 : 10
  }

  if (candidateScheme === scheme) return 40
  if (candidate.media === undefined || candidateScheme === undefined) return 24
  return 0
}

const relScore = (candidate: FaviconCandidate) => {
  if (candidate.rel.split(/\s+/).includes("icon")) return 4
  if (candidate.rel.startsWith("apple-touch-icon")) return 2
  return 0
}

const scoreCandidate = (
  candidate: FaviconCandidate,
  scheme: PreferredColorScheme | undefined,
) =>
  mediaScore(candidate, scheme) * 10_000 +
  iconTypeScore(candidate) * 1_000 +
  Math.min(parseLargestIconSize(candidate.sizes), 512) +
  relScore(candidate) * 10

export const chooseFavicon = (
  candidates: ReadonlyArray<FaviconCandidate>,
  scheme: PreferredColorScheme | undefined,
): FaviconCandidate | undefined => {
  const fallback = (() => {
    const generic = candidates.find((candidate) => !candidate.media)
    return generic ?? candidates[0]
  })()

  return candidates.reduce<FaviconCandidate | undefined>((best, candidate) => {
    if (!best) return candidate
    return scoreCandidate(candidate, scheme) >= scoreCandidate(best, scheme)
      ? candidate
      : best
  }, fallback)
}
