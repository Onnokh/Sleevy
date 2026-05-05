const TITLE_SEPARATORS = ["|", "-", "–", "—", "·", "•", "::", ":"] as const

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

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
 * Strip a trailing brand suffix like " | Fumadocs", " - YouTube", " · GitHub",
 * or the inverted form "Lightpanda | ", "GitHub - ", "Effect - " (brand before
 * the separator). Repeats until no more suffix matches (handles "Foo · bar · GitHub").
 * Never returns an empty string — falls back to the original title.
 *
 * Brand candidates are derived from the explicit `siteName` (if known) plus the
 * URL's hostname/apex/leading-label, so prose like "at scale" can't accidentally
 * match — the trailing token has to be a real brand candidate.
 */
export const stripBrandSuffix = (
  title: string,
  siteName: string | undefined,
  url: string,
): string => {
  const candidates = collectBrandCandidates(siteName, url)
  if (candidates.length === 0) return title

  const symbolPattern = TITLE_SEPARATORS.map(escapeRegex).join("|")
  // Symbol separator (with optional surrounding space), or whitespace + word
  // connector. Matched non-greedily and case-insensitively.
  const connectorPattern = `(?:\\s*(?:${symbolPattern})\\s*|\\s+(?:on|at|@)\\s+)`
  // Brand before separator at EOL (requires word boundary via ^ or whitespace so
  // we don't clip "mygithub - ").
  const brandThenSepPattern = (candidate: string) =>
    new RegExp(
      `(?:^|\\s+)${escapeRegex(candidate)}\\s*(?:${symbolPattern})\\s*$`,
      "i",
    )
  let cleaned = title.trim()

  for (let pass = 0; pass < 4; pass += 1) {
    let stripped = false
    for (const candidate of candidates) {
      const patterns = [
        new RegExp(`${connectorPattern}${escapeRegex(candidate)}\\s*$`, "i"),
        brandThenSepPattern(candidate),
      ]
      for (const pattern of patterns) {
        const next = cleaned.replace(pattern, "").trim()
        if (next.length > 0 && next !== cleaned) {
          cleaned = next
          stripped = true
          break
        }
      }
      if (stripped) break
    }
    if (!stripped) break
  }

  return cleaned || title
}
