import { randomUUID } from "node:crypto"

import { and, desc, eq, type InferSelectModel } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { EnrichmentJob, type EnrichmentJobId } from "../../domain/EnrichmentJob.js"
import {
  Link,
  LinkEnrichment,
  LinkMetadata,
  type CaptureChannel,
  type SavedItemWithLink,
  type LinkType,
  type SourceId,
  type UserId,
} from "../../domain/SavedItem.js"
import { InvalidUrl } from "../capture/CaptureError.js"
import { LinkNotFound } from "../enrichment/LinkNotFound.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  enrichmentJobsTable,
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
  savedItemsTable,
  sourcesTable,
} from "../persistence/schema.js"
import {
  toLink,
  toLinkEnrichment,
  toLinkMetadata,
  toSavedItemWithLink,
} from "./SavedItemRepository.js"

type LinkMetadataRecord = InferSelectModel<typeof linkMetadataTable>
type LinkEnrichmentRecord = InferSelectModel<typeof linkEnrichmentTable>

type PersistedStage = {
  readonly stage: EnrichmentJob["stages"][number]["stage"]
  readonly status: EnrichmentJob["stages"][number]["status"]
  readonly message?: string
  readonly startedAt: number
  readonly completedAt: number
}

type NormalizedUrl = {
  readonly originalUrl: string
  readonly normalizedUrl: string
  readonly host: string
  readonly type: LinkType
}

export type CaptureOptions = {
  readonly sourceName?: string
  readonly captureChannel?: CaptureChannel
}

export type CaptureSavedItemResult = {
  readonly savedItem: SavedItemWithLink
  readonly captureResult: "created" | "updated"
}

export type StartEnrichmentResult = {
  readonly link: Link
  readonly metadata: LinkMetadata
  readonly enrichment: LinkEnrichment
  readonly job: EnrichmentJob
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

const encodeStages = (stages: ReadonlyArray<EnrichmentJob["stages"][number]>) =>
  stages.map((stage): PersistedStage => ({
    stage: stage.stage,
    status: stage.status,
    ...(stage.message ? { message: stage.message } : {}),
    startedAt: stage.startedAt.getTime(),
    completedAt: stage.completedAt.getTime(),
  }))

export class SavedItemIntake extends Context.Service<SavedItemIntake>()(
  "@app/modules/saved-items/SavedItemIntake",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      return {
        capture: (userId: UserId, inputUrl: string, options?: CaptureOptions) =>
          Effect.gen(function* () {
            const url = yield* normalizeUrl(inputUrl)

            return yield* db.transaction((tx) =>
              Effect.gen(function* () {
                let sourceId: SourceId | undefined
                let sourceRecord: InferSelectModel<typeof sourcesTable> | undefined

                if (options?.sourceName) {
                  yield* tx
                    .insert(sourcesTable)
                    .values({ userId, name: options.sourceName })
                    .onConflictDoNothing()

                  const [row] = yield* tx
                    .select()
                    .from(sourcesTable)
                    .where(and(
                      eq(sourcesTable.userId, userId),
                      eq(sourcesTable.name, options.sourceName),
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
                    eq(savedItemsTable.userId, userId),
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
                      ...(options?.captureChannel !== undefined ? { captureChannel: options.captureChannel } : {}),
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
                  }
                }

                const [created] = yield* tx
                  .insert(savedItemsTable)
                  .values({
                    userId,
                    linkId: link.id,
                    isRead: false,
                    ...(sourceId !== undefined ? { sourceId } : {}),
                    ...(options?.captureChannel !== undefined ? { captureChannel: options.captureChannel } : {}),
                  })
                  .returning()

                if (!created) {
                  throw new Error("SavedItem insert did not return a row.")
                }

                return {
                  savedItem: toSavedItemWithLink(created, link, metadata, enrichment, sourceRecord),
                  captureResult: "created" as const,
                }
              }),
            )
          }),

        getEnrichmentStatus: (linkId: Link["id"]) =>
          Effect.gen(function* () {
            const rows = yield* db
              .select({ status: linkEnrichmentTable.status })
              .from(linkEnrichmentTable)
              .where(eq(linkEnrichmentTable.linkId, linkId))
              .limit(1)
            return rows[0]?.status as LinkEnrichment["status"] | undefined
          }),

        startEnrichment: (linkId: Link["id"]) =>
          db.transaction((tx) =>
            Effect.gen(function* () {
              const linkRows = yield* tx
                .select({
                  link: linksTable,
                  metadata: linkMetadataTable,
                  enrichment: linkEnrichmentTable,
                })
                .from(linksTable)
                .innerJoin(linkMetadataTable, eq(linksTable.id, linkMetadataTable.linkId))
                .innerJoin(linkEnrichmentTable, eq(linksTable.id, linkEnrichmentTable.linkId))
                .where(eq(linksTable.id, linkId))
                .limit(1)
              const row = linkRows[0]

              if (!row) {
                return yield* new LinkNotFound({ linkId })
              }

              const latestJobs = yield* tx
                .select()
                .from(enrichmentJobsTable)
                .where(eq(enrichmentJobsTable.linkId, linkId))
                .orderBy(desc(enrichmentJobsTable.attempt))
                .limit(1)
              const latestJob = latestJobs[0]

              const now = new Date()
              const job = new EnrichmentJob({
                id: randomUUID() as EnrichmentJobId,
                linkId,
                attempt: (latestJob?.attempt ?? 0) + 1,
                status: "running",
                stages: [],
                queuedAt: now,
                startedAt: now,
              })

              yield* tx.insert(enrichmentJobsTable).values({
                id: job.id,
                linkId: job.linkId,
                attempt: job.attempt,
                status: job.status,
                stagesJson: [],
                queuedAt: job.queuedAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
              })

              yield* tx
                .update(linkEnrichmentTable)
                .set({ status: "pending", updatedAt: now })
                .where(eq(linkEnrichmentTable.linkId, linkId))

              return {
                link: toLink(row.link),
                metadata: toLinkMetadata(row.metadata),
                enrichment: toLinkEnrichment(row.enrichment),
                job,
              }
            }),
          ),

        finishEnrichment: (
          link: Link,
          metadata: LinkMetadata,
          enrichment: LinkEnrichment,
          job: EnrichmentJob,
        ) =>
          db.transaction((tx) =>
            Effect.gen(function* () {
              const [metadataRow] = yield* tx
                .update(linkMetadataTable)
                .set({
                  title: metadata.title,
                  description: metadata.description,
                  siteName: metadata.siteName,
                  faviconUrl: metadata.faviconUrl,
                  faviconLightUrl: metadata.faviconLightUrl,
                  faviconDarkUrl: metadata.faviconDarkUrl,
                  imageUrl: metadata.imageUrl,
                  canonicalUrl: metadata.canonicalUrl,
                  fetchedAt: metadata.fetchedAt,
                  updatedAt: metadata.updatedAt,
                })
                .where(eq(linkMetadataTable.linkId, link.id))
                .returning()

              const [enrichmentRow] = yield* tx
                .update(linkEnrichmentTable)
                .set({
                  previewSummary: enrichment.previewSummary,
                  type: enrichment.type,
                  tags: [...enrichment.tags],
                  status: enrichment.status,
                  enrichedAt: enrichment.enrichedAt,
                  updatedAt: enrichment.updatedAt,
                })
                .where(eq(linkEnrichmentTable.linkId, link.id))
                .returning()

              yield* tx
                .update(enrichmentJobsTable)
                .set({
                  attempt: job.attempt,
                  status: job.status,
                  stagesJson: encodeStages(job.stages),
                  queuedAt: job.queuedAt,
                  startedAt: job.startedAt,
                  completedAt: job.completedAt,
                })
                .where(eq(enrichmentJobsTable.id, job.id))

              return {
                link,
                metadata: metadataRow ? toLinkMetadata(metadataRow) : metadata,
                enrichment: enrichmentRow ? toLinkEnrichment(enrichmentRow) : enrichment,
                job,
              }
            }),
          ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(SavedItemIntake, SavedItemIntake.make)
}
