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
  // Symbol separator (with optional surrounding space), or whitespace + word
  // connector. Matched non-greedily and case-insensitively.
  const connectorPattern = `(?:\\s*(?:${symbolPattern})\\s*|\\s+(?:on|at|@)\\s+)`

  // Brand at start followed by separator: "GitHub | Title", "YouTube - Title"
  const leadingBrandPattern = (candidate: string) =>
    new RegExp(
      `^\\s*${escapeRegex(candidate)}\\s*(?:${symbolPattern})\\s+`,
      "i",
    )

  // Separator then brand at end: "Title | GitHub", "Title - YouTube"
  const trailingSepBrandPattern = (candidate: string) =>
    new RegExp(`${connectorPattern}${escapeRegex(candidate)}\\s*$`, "i")

  // Brand then separator at end: "GitHub | ", "YouTube - "
  const trailingBrandSepPattern = (candidate: string) =>
    new RegExp(
      `(?:^|\\s+)${escapeRegex(candidate)}\\s*(?:${symbolPattern})\\s*$`,
      "i",
    )

  let cleaned = title.trim()

  for (let pass = 0; pass < 4; pass += 1) {
    let stripped = false
    for (const candidate of candidates) {
      const patterns = [
        leadingBrandPattern(candidate),
        trailingSepBrandPattern(candidate),
        trailingBrandSepPattern(candidate),
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
