import { Context, Data, Effect, Layer, Option } from "effect"
import { generateText, Output, jsonSchema } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

import { topics, type Link, type Topic } from "../../domain/SavedItem.js"
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

type TopicResult = { readonly topic: Topic | null }
type SummaryResult = { readonly summary: string | null }

const topicSchema = jsonSchema<TopicResult>({
  type: "object",
  properties: {
    topic: { type: ["string", "null"], enum: [...topics, null] },
  },
  required: ["topic"],
  additionalProperties: false,
})

const summarySchema = jsonSchema<SummaryResult>({
  type: "object",
  properties: {
    summary: { type: ["string", "null"] },
  },
  required: ["summary"],
  additionalProperties: false,
})

export class AiEnricher extends Context.Service<AiEnricher>()(
  "@app/modules/ai/AiEnricher",
  {
    make: Effect.gen(function* () {
      const config = yield* AppConfig

      if (!config.ai.enabled || !config.ai.apiKey) {
        return {
          chooseTopic: (_input: AiEnrichmentInput) =>
            Effect.succeed(Option.none<Topic>()),
          preview: (_input: AiEnrichmentInput) =>
            Effect.succeed(Option.none<string>()),
        }
      }

      const openai = createOpenAI({ apiKey: config.ai.apiKey })
      const model = openai(config.ai.model ?? "gpt-5.4-nano")

      return {
        chooseTopic: (input: AiEnrichmentInput) =>
          Effect.tryPromise({
            try: async () => {
              const { output } = await generateText({
                model,
                output: Output.object({ schema: topicSchema }),
                system:
                  "You categorize web links into a single topic. " +
                  "Pick the single best topic, or null if none fit well.\n\n" +
                  "Topic definitions:\n" +
                  "- ai: artificial intelligence, machine learning, LLMs, agents, prompts, AI tools and platforms\n" +
                  "- tools: developer tooling, CLIs, SDKs, libraries, package managers, build tools\n" +
                  "- typescript: TypeScript, JavaScript, Node.js, Deno, Bun, React, frontend frameworks\n" +
                  "- security: security, authentication, encryption, vulnerabilities, CVEs, OAuth\n" +
                  "- design: visual design, UI/UX, typography, color, layout, Figma, graphic design\n" +
                  "- backend: databases, servers, infrastructure, APIs, queues, DevOps, cloud\n" +
                  "- front-end: CSS, browser APIs, HTML, web components, accessibility, responsive design",
                prompt: buildPromptText(input),
              })
              return output?.topic
                ? Option.some(output.topic as Topic)
                : Option.none<Topic>()
            },
            catch: (cause) => new AiEnricherError({ operation: "chooseTopic", cause }),
          }),

        preview: (input: AiEnrichmentInput) =>
          Effect.tryPromise({
            try: async () => {
              const { output } = await generateText({
                model,
                output: Output.object({ schema: summarySchema }),
                system:
                  "Write a 1-2 sentence preview summary of the linked page. " +
                  "Be concise and factual. Return null if there is not enough information.",
                prompt: buildPromptText(input),
              })
              return output?.summary
                ? Option.some(output.summary)
                : Option.none<string>()
            },
            catch: (cause) => new AiEnricherError({ operation: "preview", cause }),
          }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(AiEnricher, AiEnricher.make)
}

const buildPromptText = (input: AiEnrichmentInput) => {
  const parts: string[] = [`URL: ${input.link.originalUrl}`, `Host: ${input.link.host}`]

  Option.match(input.metadata, {
    onNone: () => {},
    onSome: (metadata) => {
      if (metadata.title) parts.push(`Title: ${metadata.title}`)
      if (metadata.description) parts.push(`Description: ${metadata.description}`)
      if (metadata.siteName) parts.push(`Site: ${metadata.siteName}`)
    },
  })

  return parts.join("\n")
}
