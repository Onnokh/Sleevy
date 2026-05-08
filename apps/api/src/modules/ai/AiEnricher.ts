import { Context, Data, Effect, Layer, Option } from "effect"

import type { Link, Topic } from "../../domain/SavedItem.js"
import type { Metadata } from "../metadata/MetadataFetcher.js"
import { AppConfig } from "../../runtime/Config.js"

export class AiEnricherError extends Data.TaggedError("AiEnricherError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export type AiEnrichmentInput = {
  readonly link: Link
  readonly metadata: Option.Option<Metadata>
}

export class AiEnricher extends Context.Service<AiEnricher>()(
  "@app/modules/ai/AiEnricher",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig

      return {
        chooseTopic: (input: AiEnrichmentInput) =>
          Effect.succeed(
            config.ai.enabled ? inferTopic(input) : Option.none<Topic>(),
          ),

        preview: (input: AiEnrichmentInput) =>
          Effect.succeed(
            config.ai.enabled ? inferSummary(input) : Option.none<string>(),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(AiEnricher, AiEnricher.make)
}

const topicMatchers: ReadonlyArray<readonly [Topic, readonly string[]]> = [
  ["ai", ["artificial intelligence", "machine learning", "llm", "model", "prompt", "openai"]],
  ["tools", ["tool", "cli", "sdk", "library", "framework", "package"]],
  ["typescript", ["typescript", "javascript", "react", "node"]],
  ["security", ["security", "oauth", "auth", "cve", "vulnerability", "encryption"]],
  ["design", ["design", "ui", "ux", "visual", "typography", "figma"]],
  ["backend", ["backend", "api", "database", "postgres", "server", "queue"]],
  ["front-end", ["front-end", "frontend", "css", "browser", "component", "interface"]],
]

const sourceText = (input: AiEnrichmentInput) => {
  const metadataText = Option.match(input.metadata, {
    onNone: () => "",
    onSome: (metadata) =>
      [metadata.title, metadata.description, metadata.siteName]
        .filter((value): value is string => Boolean(value))
        .join(" "),
  })

  return [input.link.host, input.link.originalUrl, metadataText].join(" ").toLowerCase()
}

const inferTopic = (input: AiEnrichmentInput) => {
  const text = sourceText(input)
  const [topic] = topicMatchers
    .filter(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))
    .map(([topic]) => topic)

  return topic ? Option.some(topic) : Option.none<Topic>()
}

const inferSummary = (input: AiEnrichmentInput) => {
  const metadataSummary = Option.match(input.metadata, {
    onNone: () => undefined,
    onSome: (metadata) =>
      summarizeText(
        [metadata.title, metadata.description]
          .filter((value): value is string => Boolean(value))
          .join(". "),
      ),
  })

  return metadataSummary ? Option.some(metadataSummary) : Option.none<string>()
}

const summarizeText = (value: string) => {
  const sentences = value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return undefined
  }

  return sentences.slice(0, 2).join(" ").slice(0, 360).trim()
}
