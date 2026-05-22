import { Context, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSecurity,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import {
  CaptureChannel,
  EnrichmentStatus,
  SavedItemId,
  LinkType,
  Topic,
  type SavedItemWithLink,
  type UserId,
} from "../domain/SavedItem.js"
import { AuthContext, V1_SCOPES } from "../modules/auth/Scopes.js"
import { CONNECT_CLIENT_IDS } from "../modules/connect/ConnectClients.js"

export class SavedItemDto extends Schema.Class<SavedItemDto>("SavedItemDto")({
  id: SavedItemId,
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
}: SavedItemWithLink) => {
  const tags = savedItem.tags.length > 0 ? savedItem.tags : enrichment.tags

  return new SavedItemDto({
    id: savedItem.id,
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
    tags,
    enrichmentStatus: enrichment.status,
    sourceName: source?.name,
    captureChannel: savedItem.captureChannel,
    isRead: savedItem.isRead,
    lastSavedAt: savedItem.lastSavedAt,
    createdAt: savedItem.createdAt,
    updatedAt: savedItem.updatedAt,
  })
}

export class CapturePayload extends Schema.Class<CapturePayload>("CapturePayload")({
  url: Schema.String,
  sourceName: Schema.optional(Schema.String),
  captureChannel: Schema.optional(CaptureChannel),
  tags: Schema.optional(Schema.Array(Topic)),
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

export class HealthResponse extends Schema.Class<HealthResponse>("HealthResponse")({
  ok: Schema.Boolean,
}) {}

export class Unauthorized extends Schema.ErrorClass<Unauthorized>("Unauthorized")({
  _tag: Schema.tag("Unauthorized"),
  message: Schema.String,
}, { httpApiStatus: 401 }) {}

export class RateLimitExceeded extends Schema.ErrorClass<RateLimitExceeded>("RateLimitExceeded")({
  _tag: Schema.tag("RateLimitExceeded"),
  message: Schema.String,
}, { httpApiStatus: 429 }) {}

export class InvalidUrlError extends Schema.ErrorClass<InvalidUrlError>("InvalidUrlError")({
  _tag: Schema.tag("InvalidUrlError"),
  message: Schema.String,
  url: Schema.String,
}, { httpApiStatus: 400 }) {}

export class SavedItemNotFoundError extends Schema.ErrorClass<SavedItemNotFoundError>(
  "SavedItemNotFoundError",
)({
  _tag: Schema.tag("SavedItemNotFoundError"),
  message: Schema.String,
  savedItemId: SavedItemId,
}, { httpApiStatus: 404 }) {}

export class CurrentUser extends Context.Service<CurrentUser, UserId>()(
  "@app/api/CurrentUser",
) {}

export class SessionOrApiKeyAuth extends HttpApiMiddleware.Service<SessionOrApiKeyAuth, {
  provides: CurrentUser | AuthContext
}>()("@app/api/SessionOrApiKeyAuth", {
  error: Unauthorized,
  security: {
    bearer: HttpApiSecurity.bearer,
  },
}) {}

export class SessionOnlyAuth extends HttpApiMiddleware.Service<SessionOnlyAuth, {
  provides: CurrentUser
}>()("@app/api/SessionOnlyAuth", {
  error: Unauthorized,
  security: {
    bearer: HttpApiSecurity.bearer,
  },
}) {}

export const ConnectClientLiteral = Schema.Literals(CONNECT_CLIENT_IDS)
export const ConnectScopeLiteral = Schema.Literals(V1_SCOPES)

export class ConnectAuthorizePayload extends Schema.Class<ConnectAuthorizePayload>(
  "ConnectAuthorizePayload",
)({
  client: ConnectClientLiteral,
  redirectUri: Schema.String,
  codeChallenge: Schema.String,
  codeChallengeMethod: Schema.Literal("S256"),
  scopes: Schema.Array(ConnectScopeLiteral),
  label: Schema.String,
  deviceHint: Schema.optional(Schema.String),
}) {}

export class ConnectAuthorizeResponse extends Schema.Class<ConnectAuthorizeResponse>(
  "ConnectAuthorizeResponse",
)({
  code: Schema.String,
}) {}

export class ConnectExchangePayload extends Schema.Class<ConnectExchangePayload>(
  "ConnectExchangePayload",
)({
  client: ConnectClientLiteral,
  code: Schema.String,
  codeVerifier: Schema.String,
}) {}

export class ConnectExchangeResponse extends Schema.Class<ConnectExchangeResponse>(
  "ConnectExchangeResponse",
)({
  apiKey: Schema.String,
  scopes: Schema.Array(ConnectScopeLiteral),
  label: Schema.String,
}) {}

export class ConnectError extends Schema.ErrorClass<ConnectError>("ConnectError")({
  _tag: Schema.tag("ConnectError"),
  code: Schema.Literals([
    "unknown_client",
    "invalid_redirect_uri",
    "invalid_scope",
    "invalid_code",
    "invalid_verifier",
    "client_mismatch",
  ] as const),
  message: Schema.String,
}, { httpApiStatus: 400 }) {}

const capturesGroup = HttpApiGroup.make("captures")
  .add(
    HttpApiEndpoint.post("capture", "/v1/captures", {
      payload: CapturePayload,
      success: [CaptureCreated, CaptureUpdated],
      error: [InvalidUrlError, RateLimitExceeded],
    }),
  )
  .middleware(SessionOrApiKeyAuth)

const healthGroup = HttpApiGroup.make("health")
  .add(
    HttpApiEndpoint.get("check", "/health", {
      success: HealthResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("checkV1", "/v1/health", {
      success: HealthResponse,
    }),
  )

const savedItemsGroup = HttpApiGroup.make("saved-items")
  .add(
    HttpApiEndpoint.get("list", "/v1/saved-items", {
      query: SavedItemsQuery,
      success: SavedItemsResponse,
      error: RateLimitExceeded,
    }),
  )
  .add(
    HttpApiEndpoint.post("markOpened", "/v1/saved-items/:id/open", {
      params: Schema.Struct({ id: SavedItemId }),
      success: SavedItemDto,
      error: [SavedItemNotFoundError, RateLimitExceeded],
    }),
  )
  .add(
    HttpApiEndpoint.post("markRead", "/v1/saved-items/:id/read", {
      params: Schema.Struct({ id: SavedItemId }),
      success: SavedItemDto,
      error: [SavedItemNotFoundError, RateLimitExceeded],
    }),
  )
  .add(
    HttpApiEndpoint.post("markUnread", "/v1/saved-items/:id/unread", {
      params: Schema.Struct({ id: SavedItemId }),
      success: SavedItemDto,
      error: [SavedItemNotFoundError, RateLimitExceeded],
    }),
  )
  .add(
    HttpApiEndpoint.post("setReadState", "/v1/saved-items/:id/read-state", {
      params: Schema.Struct({ id: SavedItemId }),
      payload: SavedItemReadStatePayload,
      success: SavedItemDto,
      error: [SavedItemNotFoundError, RateLimitExceeded],
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/v1/saved-items/:id", {
      params: Schema.Struct({ id: SavedItemId }),
      success: HttpApiSchema.NoContent,
      error: RateLimitExceeded,
    }),
  )
  .middleware(SessionOrApiKeyAuth)

const connectAuthorizeGroup = HttpApiGroup.make("connect-authorize")
  .add(
    HttpApiEndpoint.post("authorize", "/connect/authorize", {
      payload: ConnectAuthorizePayload,
      success: ConnectAuthorizeResponse,
      error: ConnectError,
    }),
  )
  .middleware(SessionOnlyAuth)

const connectExchangeGroup = HttpApiGroup.make("connect-exchange")
  .add(
    HttpApiEndpoint.post("exchange", "/connect/exchange", {
      payload: ConnectExchangePayload,
      success: ConnectExchangeResponse,
      error: [ConnectError, RateLimitExceeded],
    }),
  )

export const sleevyApi = HttpApi.make("SleevyApi")
  .annotate(OpenApi.Title, "Sleevy API")
  .annotate(OpenApi.Description, "REST API for saving, listing, and managing your read-later queue.")
  .annotate(OpenApi.Version, "1.0.0")
  .add(healthGroup)
  .add(capturesGroup)
  .add(savedItemsGroup)
  .add(connectAuthorizeGroup)
  .add(connectExchangeGroup)
