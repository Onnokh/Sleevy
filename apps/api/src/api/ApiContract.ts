import { Context, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
} from "effect/unstable/httpapi"

import {
  CaptureChannel,
  EnrichmentStatus,
  SavedItemId,
  LinkId,
  LinkType,
  Topic,
  type SavedItemWithLink,
  type UserId,
} from "../domain/SavedItem.js"

export class SavedItemDto extends Schema.Class<SavedItemDto>("SavedItemDto")({
  id: SavedItemId,
  userId: Schema.String,
  linkId: LinkId,
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
  lastSavedAt: Schema.Date,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

export const savedItemToDto = ({
  savedItem,
  link,
  metadata,
  enrichment,
  source,
}: SavedItemWithLink) =>
  new SavedItemDto({
    id: savedItem.id,
    userId: savedItem.userId,
    linkId: savedItem.linkId,
    originalUrl: link.originalUrl,
    normalizedUrl: link.normalizedUrl,
    host: link.host,
    title: metadata.title,
    description: metadata.description,
    siteName: metadata.siteName,
    faviconUrl: metadata.faviconUrl,
    faviconLightUrl: metadata.faviconLightUrl,
    faviconDarkUrl: metadata.faviconDarkUrl,
    imageUrl: metadata.imageUrl,
    canonicalUrl: metadata.canonicalUrl,
    previewSummary: enrichment.previewSummary,
    type: enrichment.type,
    tags: enrichment.tags,
    enrichmentStatus: enrichment.status,
    sourceName: source?.name,
    captureChannel: savedItem.captureChannel,
    isRead: savedItem.isRead,
    lastSavedAt: savedItem.lastSavedAt,
    createdAt: savedItem.createdAt,
    updatedAt: savedItem.updatedAt,
  })

export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  url: Schema.String,
  sourceName: Schema.optional(Schema.String),
  captureChannel: Schema.optional(CaptureChannel),
}) {}

export class CaptureCreated extends Schema.Class<CaptureCreated>("CaptureCreated")({
  savedItem: SavedItemDto,
  captureResult: Schema.Literal("created"),
}, { httpApiStatus: 201 }) {}

export class CaptureUpdated extends Schema.Class<CaptureUpdated>("CaptureUpdated")({
  savedItem: SavedItemDto,
  captureResult: Schema.Literal("updated"),
}, { httpApiStatus: 200 }) {}

export class SavedItemsResponse extends Schema.Class<SavedItemsResponse>("SavedItemsResponse")({
  savedItems: Schema.Array(SavedItemDto),
}) {}

export const savedItemSorts = ["newest", "oldest", "title", "unread"] as const
export const SavedItemSort = Schema.Literals(savedItemSorts)
export type SavedItemSort = typeof SavedItemSort.Type

export class SavedItemsQuery extends Schema.Class<SavedItemsQuery>("SavedItemsQuery")({
  sort: Schema.optional(SavedItemSort),
}) {}

export class SavedItemReadStatePayload extends Schema.Class<SavedItemReadStatePayload>(
  "SavedItemReadStatePayload",
)({
  isRead: Schema.Boolean,
}) {}

export class Unauthorized extends Schema.ErrorClass<Unauthorized>("Unauthorized")({
  _tag: Schema.tag("Unauthorized"),
  message: Schema.String,
}, { httpApiStatus: 401 }) {}

export class InvalidUrlError extends Schema.ErrorClass<InvalidUrlError>("InvalidUrlError")({
  _tag: Schema.tag("InvalidUrlError"),
  url: Schema.String,
}, { httpApiStatus: 400 }) {}

export class SavedItemNotFoundError extends Schema.ErrorClass<SavedItemNotFoundError>(
  "SavedItemNotFoundError",
)({
  _tag: Schema.tag("SavedItemNotFoundError"),
  savedItemId: SavedItemId,
}, { httpApiStatus: 404 }) {}

export class CurrentUser extends Context.Service<CurrentUser, UserId>()(
  "@app/api/CurrentUser",
) {}

export class SessionOrApiKeyAuth extends HttpApiMiddleware.Service<SessionOrApiKeyAuth, {
  provides: CurrentUser
}>()("@app/api/SessionOrApiKeyAuth", {
  error: Unauthorized,
}) {}

const capturesGroup = HttpApiGroup.make("captures")
  .add(
    HttpApiEndpoint.post("capture", "/v1/captures", {
      payload: CapturePayload,
      success: [CaptureCreated, CaptureUpdated],
      error: InvalidUrlError,
    }),
  )
  .middleware(SessionOrApiKeyAuth)

const savedItemsGroup = HttpApiGroup.make("saved-items")
  .add(
    HttpApiEndpoint.get("list", "/v1/saved-items", {
      query: SavedItemsQuery,
      success: SavedItemsResponse,
    }),
  )
  .add(
    HttpApiEndpoint.post("markOpened", "/v1/saved-items/:id/open", {
      params: Schema.Struct({ id: SavedItemId }),
      success: SavedItemDto,
      error: SavedItemNotFoundError,
    }),
  )
  .add(
    HttpApiEndpoint.post("setReadState", "/v1/saved-items/:id/read", {
      params: Schema.Struct({ id: SavedItemId }),
      payload: SavedItemReadStatePayload,
      success: SavedItemDto,
      error: SavedItemNotFoundError,
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/v1/saved-items/:id", {
      params: Schema.Struct({ id: SavedItemId }),
      success: HttpApiSchema.NoContent,
    }),
  )
  .middleware(SessionOrApiKeyAuth)

export const sleevyApi = HttpApi.make("SleevyApi")
  .add(capturesGroup)
  .add(savedItemsGroup)
