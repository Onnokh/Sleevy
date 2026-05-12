import { Schema } from "effect";

export const SavedItemId = Schema.String.pipe(Schema.brand("SavedItemId"));
export type SavedItemId = typeof SavedItemId.Type;

export const LinkId = Schema.String.pipe(Schema.brand("LinkId"));
export type LinkId = typeof LinkId.Type;

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const SourceId = Schema.String.pipe(Schema.brand("SourceId"));
export type SourceId = typeof SourceId.Type;

export const enrichmentStatuses = ["pending", "enriched", "failed"] as const;
export const EnrichmentStatus = Schema.Literals(enrichmentStatuses);
export type EnrichmentStatus = typeof EnrichmentStatus.Type;

export const linkTypes = [
  "article",
  "video",
  "website",
  "repository",
] as const;
export const LinkType = Schema.Literals(linkTypes);
export type LinkType = typeof LinkType.Type;

export const topics = [
  "ai",
  "tools",
  "typescript",
  "security",
  "design",
  "backend",
  "front-end",
] as const;
export const Topic = Schema.Literals(topics);
export type Topic = typeof Topic.Type;

export const captureChannels = [
  "chrome-extension",
  "ios-app",
  "ios-share-extension",
  "raycast",
  "web-companion",
  "api",
] as const;
export const CaptureChannel = Schema.Literals(captureChannels);
export type CaptureChannel = typeof CaptureChannel.Type;

export class Link extends Schema.Class<Link>("Link")({
  id: LinkId,
  originalUrl: Schema.String,
  normalizedUrl: Schema.String,
  host: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export class LinkMetadata extends Schema.Class<LinkMetadata>("LinkMetadata")({
  linkId: LinkId,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  siteName: Schema.optional(Schema.String),
  faviconUrl: Schema.optional(Schema.String),
  faviconLightUrl: Schema.optional(Schema.String),
  faviconDarkUrl: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  canonicalUrl: Schema.optional(Schema.String),
  fetchedAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export class LinkEnrichment extends Schema.Class<LinkEnrichment>("LinkEnrichment")({
  linkId: LinkId,
  previewSummary: Schema.optional(Schema.String),
  type: LinkType,
  tags: Schema.Array(Topic),
  status: EnrichmentStatus,
  enrichedAt: Schema.optional(Schema.Date),
  updatedAt: Schema.Date,
}) {}

export class Source extends Schema.Class<Source>("Source")({
  id: SourceId,
  userId: UserId,
  name: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export class SavedItem extends Schema.Class<SavedItem>("SavedItem")({
  id: SavedItemId,
  userId: UserId,
  linkId: LinkId,
  sourceId: Schema.optional(SourceId),
  captureChannel: Schema.optional(CaptureChannel),
  tags: Schema.Array(Topic),
  isRead: Schema.Boolean,
  lastSavedAt: Schema.Date,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export type SavedItemWithLink = {
  readonly savedItem: SavedItem
  readonly link: Link
  readonly metadata: LinkMetadata
  readonly enrichment: LinkEnrichment
  readonly source?: Source
}
