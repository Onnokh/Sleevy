/**
 * Resolve a relative URL against a base URL. Returns undefined for unparseable
 * inputs (rather than throwing) so callers can use it inline.
 */
export const toAbsoluteUrl = (
  candidate: string | undefined,
  baseUrl: string,
): string | undefined => {
  if (!candidate) return undefined
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return undefined
  }
}

/**
 * Lowercase hostname with leading `www.` stripped. Returns undefined if the
 * input isn't a parseable URL.
 */
export const normalizeHostname = (rawUrl: string): string | undefined => {
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return undefined
  }
}
