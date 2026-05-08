import { and, desc, eq, type InferSelectModel, type SQL } from "drizzle-orm"
import { Context, Effect, Layer, Option, Schema } from "effect"

import {
  SavedItem,
  Link,
  LinkEnrichment,
  LinkMetadata,
  type SavedItemWithLink,
  type UserId,
  type LinkId,
} from "../../domain/SavedItem.js"
import { PostgresClient } from "../persistence/PostgresClient.js"
import {
  linkEnrichmentTable,
  linkMetadataTable,
  linksTable,
  savedItemsTable,
} from "../persistence/schema.js"

export type SavedItemRecord = InferSelectModel<typeof savedItemsTable>
export type LinkRecord = InferSelectModel<typeof linksTable>
export type LinkMetadataRecord = InferSelectModel<typeof linkMetadataTable>
export type LinkEnrichmentRecord = InferSelectModel<typeof linkEnrichmentTable>

const decodeSavedItem = Schema.decodeUnknownSync(SavedItem)
const decodeLink = Schema.decodeUnknownSync(Link)
const decodeLinkMetadata = Schema.decodeUnknownSync(LinkMetadata)
const decodeLinkEnrichment = Schema.decodeUnknownSync(LinkEnrichment)

const nullsToUndefined = <T extends Record<string, unknown>>(record: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(record)) {
    const value = record[key]
    result[key] = value === null ? undefined : value
  }
  return result
}

export const toSavedItem = (record: SavedItemRecord): SavedItem =>
  decodeSavedItem(nullsToUndefined(record))

export const toLink = (record: LinkRecord): Link =>
  decodeLink(nullsToUndefined(record))

export const toLinkMetadata = (record: LinkMetadataRecord): LinkMetadata =>
  decodeLinkMetadata(nullsToUndefined(record))

export const toLinkEnrichment = (record: LinkEnrichmentRecord): LinkEnrichment =>
  decodeLinkEnrichment(nullsToUndefined(record))

export const toSavedItemWithLink = (
  savedItem: SavedItemRecord,
  link: LinkRecord,
  metadata: LinkMetadataRecord,
  enrichment: LinkEnrichmentRecord,
): SavedItemWithLink => ({
  savedItem: toSavedItem(savedItem),
  link: toLink(link),
  metadata: toLinkMetadata(metadata),
  enrichment: toLinkEnrichment(enrichment),
})

export class SavedItemRepository extends Context.Service<SavedItemRepository>()(
  "@app/modules/saved-items/SavedItemRepository",
  {
    make: Effect.gen(function* () {
      const { db } = yield* PostgresClient

      const selectSavedItemWithLink = (filter: SQL | undefined) =>
        db
          .select({
            savedItem: savedItemsTable,
            link: linksTable,
            metadata: linkMetadataTable,
            enrichment: linkEnrichmentTable,
          })
          .from(savedItemsTable)
          .innerJoin(linksTable, eq(savedItemsTable.linkId, linksTable.id))
          .innerJoin(linkMetadataTable, eq(linksTable.id, linkMetadataTable.linkId))
          .innerJoin(linkEnrichmentTable, eq(linksTable.id, linkEnrichmentTable.linkId))
          .where(filter)

      const selectLinkWithCompanions = (linkId: LinkId) =>
        db
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

      const toAggregate = (row: {
        savedItem: SavedItemRecord
        link: LinkRecord
        metadata: LinkMetadataRecord
        enrichment: LinkEnrichmentRecord
      }) => toSavedItemWithLink(row.savedItem, row.link, row.metadata, row.enrichment)

      return {
        findByUserAndId: (userId: UserId, id: SavedItem["id"]) =>
          Effect.gen(function* () {
            const rows = yield* selectSavedItemWithLink(
              and(eq(savedItemsTable.userId, userId), eq(savedItemsTable.id, id)),
            ).limit(1)

            return rows[0]
              ? Option.some(toAggregate(rows[0]))
              : Option.none<SavedItemWithLink>()
          }),

        listByUser: (userId: UserId) =>
          Effect.gen(function* () {
            const rows = yield* selectSavedItemWithLink(
              eq(savedItemsTable.userId, userId),
            ).orderBy(desc(savedItemsTable.lastSavedAt), desc(savedItemsTable.id))

            return rows.map(toAggregate)
          }),

        setReadState: (id: SavedItem["id"], isRead: boolean) =>
          Effect.gen(function* () {
            const [row] = yield* db
              .update(savedItemsTable)
              .set({ isRead, updatedAt: new Date() })
              .where(eq(savedItemsTable.id, id))
              .returning()

            if (!row) {
              return Option.none<SavedItemWithLink>()
            }

            const linkRows = yield* selectLinkWithCompanions(row.linkId)
            const joined = linkRows[0]

            return joined
              ? Option.some(toSavedItemWithLink(row, joined.link, joined.metadata, joined.enrichment))
              : Option.none<SavedItemWithLink>()
          }),

        deleteByUserAndId: (userId: UserId, id: SavedItem["id"]) =>
          db.delete(savedItemsTable).where(and(
            eq(savedItemsTable.userId, userId),
            eq(savedItemsTable.id, id),
          )),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(SavedItemRepository, SavedItemRepository.make)
}
