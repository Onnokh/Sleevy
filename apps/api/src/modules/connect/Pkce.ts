import { createHash } from "node:crypto"

const base64UrlEncode = (buffer: Buffer): string =>
  buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")

export const verifyPkceS256 = (verifier: string, challenge: string): boolean => {
  if (!verifier || !challenge) return false
  const computed = base64UrlEncode(createHash("sha256").update(verifier).digest())
  return computed === challenge
}
