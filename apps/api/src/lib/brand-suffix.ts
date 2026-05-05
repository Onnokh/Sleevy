const TITLE_SEPARATORS = ["|", "-", "–", "—", "·", "•", "::", ":"] as const

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Normalize a string for comparison by lowercasing and removing all whitespace.
 */
const normalizeForCompare = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, "")

const collectBrandCandidates = (
  siteName: string | undefined,
  url: string,
): ReadonlyArray<string> => {
  const candidates: Array<string> = []
  if (siteName) candidates.push(siteName)

  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "")
    candidates.push(hostname)
    const apex = hostname.split(".").slice(-2).join(".")
    if (apex && apex !== hostname) candidates.push(apex)
    const brand = hostname.split(".")[0]
    if (brand && brand.length >= 3) candidates.push(brand)
  } catch {
    /* ignore */
  }

  return candidates.filter((candidate) => candidate.trim().length >= 2)
}

/**
 * Strip leading and trailing brand markers like "GitHub | Title" or "Title | Fumadocs".
 * Handles patterns like "Brand | Title", "Title - YouTube", "GitHub · ", or " · GitHub".
 * Repeats until no more matches (handles "GitHub · Foo · GitHub").
 * Never returns an empty string — falls back to the original title.
 *
 * Brand candidates are derived from the explicit `siteName` (if known) plus the
 * URL's hostname/apex/leading-label, so prose like "at scale" can't accidentally
 * match — the token has to be a real brand candidate.
 */
export const stripBrandSuffix = (
  title: string,
  siteName: string | undefined,
  url: string,
): string => {
  const candidates = collectBrandCandidates(siteName, url)
  if (candidates.length === 0) return title

  const symbolPattern = TITLE_SEPARATORS.map(escapeRegex).join("|")

  let cleaned = title.trim()

  for (let pass = 0; pass < 4; pass += 1) {
    let stripped = false

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeForCompare(candidate)

      // Try to strip leading brand: "Brand | Title" or "Brand - Title"
      const leadingMatch = cleaned.match(
        new RegExp(`^(.+?)(?:\\s+(?:${symbolPattern})\\s+|\\s+(?:on|at|@)\\s+)`),
      )
      if (leadingMatch) {
        const potentialBrand = leadingMatch[1]
        if (normalizeForCompare(potentialBrand) === normalizedCandidate) {
          cleaned = cleaned.slice(leadingMatch[0].length).trim()
          stripped = true
          break
        }
      }

      // Try to strip trailing brand with separator: "Title | Brand"
      const trailingSepMatch = cleaned.match(
        new RegExp(`(?:\\s*(?:${symbolPattern})\\s+|\\s+(?:on|at|@)\\s+)(.+?)$`),
      )
      if (trailingSepMatch) {
        const potentialBrand = trailingSepMatch[1].trim()
        if (normalizeForCompare(potentialBrand) === normalizedCandidate) {
          cleaned = cleaned.slice(0, -trailingSepMatch[0].length).trim()
          stripped = true
          break
        }
      }

      // Try to strip trailing brand with separator after it: "Brand | " or "Brand -"
      const trailingBrandSepMatch = cleaned.match(
        new RegExp(`^(.+?)(?:\\s+(?:${symbolPattern})\\s*)$`),
      )
      if (trailingBrandSepMatch) {
        const potentialBrand = trailingBrandSepMatch[1].trim()
        if (normalizeForCompare(potentialBrand) === normalizedCandidate) {
          cleaned = cleaned.slice(0, -trailingBrandSepMatch[0].length).trim()
          stripped = true
          break
        }
      }
    }

    if (!stripped) break
  }

  return cleaned || title
}
