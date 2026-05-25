// @sleevy/contract — the canonical wire shape of the Sleevy REST API.
//
// This is the single source of truth for the API contract. The schemas defined
// here are imported by apps/api (which uses them directly in HttpApiEndpoint
// route definitions) and by TypeScript clients (apps/web, apps/chrome-extension,
// and vendored into apps/raycast-plugin), which use them as type-only imports
// to derive plain wire types.
//
// For non-Effect consumers, each Schema.Class exposes a merged namespace with
// an `Encoded` type alias representing the JSON wire shape:
//
//   import type { SavedItemDto } from "@sleevy/contract"
//   const items: SavedItemDto.Encoded[] = await response.json()
//
// IDs cross the wire as plain strings. Dates cross as ISO 8601 strings.

import { Schema } from "effect"

// ─── Enum vocabularies ──────────────────────────────────────────────────────

export const linkTypes = [
  "article",
  "video",
  "website",
  "repository",
] as const
export const LinkType = Schema.Literals(linkTypes)
export type LinkType = typeof LinkType.Type

export const topics = [
  "ai",
  "tools",
  "typescript",
  "security",
  "design",
  "backend",
  "front-end",
] as const
export const Topic = Schema.Literals(topics)
export type Topic = typeof Topic.Type

export const captureChannels = [
  "chrome-extension",
  "ios-app",
  "ios-share-extension",
  "raycast",
  "web-companion",
  "api",
] as const
export const CaptureChannel = Schema.Literals(captureChannels)
export type CaptureChannel = typeof CaptureChannel.Type

export const enrichmentStatuses = ["pending", "enriched", "failed"] as const
export const EnrichmentStatus = Schema.Literals(enrichmentStatuses)
export type EnrichmentStatus = typeof EnrichmentStatus.Type

export const savedItemSorts = ["newest", "oldest", "title", "unread"] as const
export const SavedItemSort = Schema.Literals(savedItemSorts)
export type SavedItemSort = typeof SavedItemSort.Type

// ─── Success DTOs ───────────────────────────────────────────────────────────

export class SavedItemDto extends Schema.Class<SavedItemDto>("SavedItemDto")({
  id: Schema.String,
  originalUrl: Schema.String,
  normalizedUrl: Schema.String,
  host: Schema.String,
  title: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  siteName: Schema.optional(Schema.String),
  faviconUrl: Schema.optional(Schema.String),
  faviconLightUrl: Schema.optional(Schema.String),
  faviconDarkUrl: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  canonicalUrl: Schema.optional(Schema.String),
  previewSummary: Schema.optional(Schema.String),
  type: LinkType,
  tags: Schema.Array(Topic),
  enrichmentStatus: EnrichmentStatus,
  sourceName: Schema.optional(Schema.String),
  captureChannel: Schema.optional(CaptureChannel),
  isRead: Schema.Boolean,
  lastSavedAt: Schema.DateFromString,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}
export namespace SavedItemDto {
  export type Encoded = Schema.Codec.Encoded<typeof SavedItemDto>
}

export class SavedItemsResponse extends Schema.Class<SavedItemsResponse>("SavedItemsResponse")({
  savedItems: Schema.Array(SavedItemDto),
}) {}
export namespace SavedItemsResponse {
  export type Encoded = Schema.Codec.Encoded<typeof SavedItemsResponse>
}

export class CaptureCreated extends Schema.Class<CaptureCreated>("CaptureCreated")({
  savedItem: SavedItemDto,
  captureResult: Schema.Literal("created"),
}, { httpApiStatus: 201 }) {}
export namespace CaptureCreated {
  export type Encoded = Schema.Codec.Encoded<typeof CaptureCreated>
}

export class CaptureUpdated extends Schema.Class<CaptureUpdated>("CaptureUpdated")({
  savedItem: SavedItemDto,
  captureResult: Schema.Literal("updated"),
}, { httpApiStatus: 200 }) {}
export namespace CaptureUpdated {
  export type Encoded = Schema.Codec.Encoded<typeof CaptureUpdated>
}

export type CaptureResponseEncoded = CaptureCreated.Encoded | CaptureUpdated.Encoded

export class HealthResponse extends Schema.Class<HealthResponse>("HealthResponse")({
  ok: Schema.Boolean,
}) {}
export namespace HealthResponse {
  export type Encoded = Schema.Codec.Encoded<typeof HealthResponse>
}

// ─── Request payloads ───────────────────────────────────────────────────────

export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  url: Schema.String,
  sourceName: Schema.optional(Schema.String),
  captureChannel: Schema.optional(CaptureChannel),
  tags: Schema.optional(Schema.Array(Topic)),
}) {}
export namespace CapturePayload {
  export type Encoded = Schema.Codec.Encoded<typeof CapturePayload>
}

export class SavedItemReadStatePayload extends Schema.Class<SavedItemReadStatePayload>(
  "SavedItemReadStatePayload",
)({
  isRead: Schema.Boolean,
}) {}
export namespace SavedItemReadStatePayload {
  export type Encoded = Schema.Codec.Encoded<typeof SavedItemReadStatePayload>
}

export class SavedItemsQuery extends Schema.Class<SavedItemsQuery>("SavedItemsQuery")({
  sort: Schema.optional(SavedItemSort),
}) {}
export namespace SavedItemsQuery {
  export type Encoded = Schema.Codec.Encoded<typeof SavedItemsQuery>
}

// ─── Error shapes ───────────────────────────────────────────────────────────

export class Unauthorized extends Schema.ErrorClass<Unauthorized>("Unauthorized")({
  _tag: Schema.tag("Unauthorized"),
  message: Schema.String,
}, { httpApiStatus: 401 }) {}
export namespace Unauthorized {
  export type Encoded = Schema.Codec.Encoded<typeof Unauthorized>
}

export class RateLimitExceeded extends Schema.ErrorClass<RateLimitExceeded>("RateLimitExceeded")({
  _tag: Schema.tag("RateLimitExceeded"),
  message: Schema.String,
}, { httpApiStatus: 429 }) {}
export namespace RateLimitExceeded {
  export type Encoded = Schema.Codec.Encoded<typeof RateLimitExceeded>
}

export class InvalidUrlError extends Schema.ErrorClass<InvalidUrlError>("InvalidUrlError")({
  _tag: Schema.tag("InvalidUrlError"),
  message: Schema.String,
  url: Schema.String,
}, { httpApiStatus: 400 }) {}
export namespace InvalidUrlError {
  export type Encoded = Schema.Codec.Encoded<typeof InvalidUrlError>
}

export class SavedItemNotFoundError extends Schema.ErrorClass<SavedItemNotFoundError>(
  "SavedItemNotFoundError",
)({
  _tag: Schema.tag("SavedItemNotFoundError"),
  message: Schema.String,
  savedItemId: Schema.String,
}, { httpApiStatus: 404 }) {}
export namespace SavedItemNotFoundError {
  export type Encoded = Schema.Codec.Encoded<typeof SavedItemNotFoundError>
}

export type ApiErrorEncoded =
  | Unauthorized.Encoded
  | RateLimitExceeded.Encoded
  | InvalidUrlError.Encoded
  | SavedItemNotFoundError.Encoded
