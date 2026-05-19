import { and, eq, type InferSelectModel } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import type {
  CaptureChannel,
  LinkId,
  LinkType,
  SavedItemWithLink,
  SourceId,
  Topic,
  UserId,
} from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
  savedItemsTable,
  sourcesTable,
} from "../persistence/schema.js"
import { toSavedItemWithLink } from "../saved-items/SavedItemRepository.js"
import { InvalidUrl } from "./CaptureError.js"

export type CaptureServiceError = InvalidUrl

type LinkMetadataRecord = InferSelectModel<typeof linkMetadataTable>
type LinkEnrichmentRecord = InferSelectModel<typeof linkEnrichmentTable>

type NormalizedUrl = {
  readonly originalUrl: string
  readonly normalizedUrl: string
  readonly host: string
  readonly type: LinkType
}

export type CaptureInput = {
  readonly userId: UserId
  readonly url: string
  readonly sourceName?: string
  readonly captureChannel?: CaptureChannel
  readonly tags?: readonly Topic[]
}

export type CaptureResult = {
  readonly savedItem: SavedItemWithLink
  readonly captureResult: "created" | "updated"
  readonly enrichment:
    | { readonly _tag: "start"; readonly linkId: LinkId }
    | { readonly _tag: "skip" }
}

const inferType = (url: URL): LinkType => {
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  const href = url.toString().toLowerCase()

  if (host === "github.com" || host === "gitlab.com") {
    return "repository"
  }

  if (host === "youtube.com" || host === "youtu.be" || host === "vimeo.com") {
    return "video"
  }

  if (href.includes("blog") || href.includes("article")) {
    return "article"
  }

  return "website"
}

const normalizeUrl = (input: string): Effect.Effect<NormalizedUrl, InvalidUrl> =>
  Effect.try({
    try: () => {
      const original = new URL(input.trim())
      const normalized = new URL(original)
      normalized.hash = ""
      normalized.protocol = normalized.protocol.toLowerCase()
      normalized.hostname = normalized.hostname.toLowerCase()

      if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
        throw new Error("Unsupported URL protocol.")
      }

      if (
        (normalized.protocol === "https:" && normalized.port === "443") ||
        (normalized.protocol === "http:" && normalized.port === "80")
      ) {
        normalized.port = ""
      }

      normalized.searchParams.sort()

      return {
        originalUrl: original.toString(),
        normalizedUrl: normalized.toString(),
        host: normalized.host,
        type: inferType(normalized),
      }
    },
    catch: () => new InvalidUrl({ url: input }),
  })

export class CaptureService extends Context.Service<CaptureService>()(
  "@app/modules/capture/CaptureService",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        capture: (input: CaptureInput) =>
          Effect.gen(function* () {
            const url = yield* normalizeUrl(input.url)

            return yield* db.transaction((tx) =>
              Effect.gen(function* () {
                let sourceId: SourceId | undefined
                let sourceRecord: InferSelectModel<typeof sourcesTable> | undefined

                if (input.sourceName) {
                  yield* tx
                    .insert(sourcesTable)
                    .values({ userId: input.userId, name: input.sourceName })
                    .onConflictDoNothing()

                  const [row] = yield* tx
                    .select()
                    .from(sourcesTable)
                    .where(and(
                      eq(sourcesTable.userId, input.userId),
                      eq(sourcesTable.name, input.sourceName),
                    ))
                    .limit(1)

                  if (row) {
                    sourceRecord = row
                    sourceId = row.id
                  }
                }

                const linkRows = yield* tx
                  .select()
                  .from(linksTable)
                  .where(eq(linksTable.normalizedUrl, url.normalizedUrl))
                  .limit(1)
                let link = linkRows[0]
                let metadata: LinkMetadataRecord | undefined
                let enrichment: LinkEnrichmentRecord | undefined

                if (!link) {
                  const [createdLink] = yield* tx
                    .insert(linksTable)
                    .values({
                      originalUrl: url.originalUrl,
                      normalizedUrl: url.normalizedUrl,
                      host: url.host,
                    })
                    .returning()

                  if (!createdLink) {
                    throw new Error("Link insert did not return a row.")
                  }

                  const [createdMetadata] = yield* tx
                    .insert(linkMetadataTable)
                    .values({ linkId: createdLink.id })
                    .returning()
                  const [createdEnrichment] = yield* tx
                    .insert(linkEnrichmentTable)
                    .values({
                      linkId: createdLink.id,
                      type: url.type,
                      tags: [],
                      status: "pending",
                    })
                    .returning()

                  if (!createdMetadata || !createdEnrichment) {
                    throw new Error("Link companion insert did not return a row.")
                  }

                  link = createdLink
                  metadata = createdMetadata
                  enrichment = createdEnrichment
                } else {
                  const metadataRows = yield* tx
                    .select()
                    .from(linkMetadataTable)
                    .where(eq(linkMetadataTable.linkId, link.id))
                    .limit(1)
                  const enrichmentRows = yield* tx
                    .select()
                    .from(linkEnrichmentTable)
                    .where(eq(linkEnrichmentTable.linkId, link.id))
                    .limit(1)

                  metadata = metadataRows[0]
                  enrichment = enrichmentRows[0]

                  if (!metadata) {
                    const [createdMetadata] = yield* tx
                      .insert(linkMetadataTable)
                      .values({ linkId: link.id })
                      .returning()
                    metadata = createdMetadata
                  }

                  if (!enrichment) {
                    const [createdEnrichment] = yield* tx
                      .insert(linkEnrichmentTable)
                      .values({
                        linkId: link.id,
                        type: url.type,
                        tags: [],
                        status: "pending",
                      })
                      .returning()
                    enrichment = createdEnrichment
                  }

                  if (!metadata || !enrichment) {
                    throw new Error("Link companion insert did not return a row.")
                  }
                }

                const existingRows = yield* tx
                  .select()
                  .from(savedItemsTable)
                  .where(and(
                    eq(savedItemsTable.userId, input.userId),
                    eq(savedItemsTable.linkId, link.id),
                  ))
                  .limit(1)
                const existing = existingRows[0]

                if (existing) {
                  const now = new Date()
                  const [updated] = yield* tx
                    .update(savedItemsTable)
                    .set({
                      isRead: false,
                      lastSavedAt: now,
                      updatedAt: now,
                      ...(sourceId !== undefined ? { sourceId } : {}),
                      ...(input.captureChannel !== undefined ? { captureChannel: input.captureChannel } : {}),
                      ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
                    })
                    .where(eq(savedItemsTable.id, existing.id))
                    .returning()

                  return {
                    savedItem: toSavedItemWithLink(
                      updated ?? existing,
                      link,
                      metadata,
                      enrichment,
                      sourceRecord,
                    ),
                    captureResult: "updated" as const,
                    enrichment: { _tag: "start", linkId: link.id },
                  }
                }

                const [created] = yield* tx
                  .insert(savedItemsTable)
                  .values({
                    userId: input.userId,
                    linkId: link.id,
                    isRead: false,
                    tags: input.tags ? [...input.tags] : [],
                    ...(sourceId !== undefined ? { sourceId } : {}),
                    ...(input.captureChannel !== undefined ? { captureChannel: input.captureChannel } : {}),
                  })
                  .returning()

                if (!created) {
                  throw new Error("SavedItem insert did not return a row.")
                }

                return {
                  savedItem: toSavedItemWithLink(created, link, metadata, enrichment, sourceRecord),
                  captureResult: "created" as const,
                  enrichment: { _tag: "start", linkId: link.id },
                }
              }),
            )
          }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(CaptureService, CaptureService.make)
}
