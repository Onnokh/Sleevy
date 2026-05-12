# Sleevy API

Backend API workspace for Sleevy's v1 REST API.

The API serves the Web Companion, native clients, browser extension, Raycast plugin, and personal automation clients.

## Local Development

```sh
bun install
bun --filter @sleevy/api dev
```

The generated OpenAPI document is served at:

```text
GET /openapi.json
```

A lightweight health check is available without authentication:

```text
GET /health
GET /v1/health
```

## Authentication

External systems authenticate with a personal API Key:

```http
Authorization: Bearer <api-key>
```

API Keys belong to one Account, can access the v1 REST API for that Account, and are subject to the v1 API Key Rate Limit.

## Core Endpoints

```http
POST /v1/captures
GET /v1/saved-items
POST /v1/saved-items/{id}/open
POST /v1/saved-items/{id}/read
DELETE /v1/saved-items/{id}
```

Example capture request:

```sh
curl -X POST "$SLEEVY_API_URL/v1/captures" \
  -H "Authorization: Bearer $SLEEVY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","captureChannel":"api","tags":["backend"]}'
```

Capture `tags` are optional. When provided, they are stored on the Saved Item for the authenticated Account and must use the v1 Tag vocabulary: `ai`, `tools`, `typescript`, `security`, `design`, `backend`, or `front-end`.

Requests over the API Key Rate Limit receive `429 Too Many Requests` with `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers.

## Error Responses

Errors use a small tagged JSON shape:

```json
{
  "_tag": "Unauthorized",
  "message": "Missing or invalid credentials."
}
```

Every public error includes `_tag` and `message`. Some errors include extra fields with useful context, such as the rejected `url` or missing `savedItemId`.

Current v1 errors:

| Status | `_tag` | Meaning |
| --- | --- | --- |
| 400 | `InvalidUrlError` | The capture payload did not contain a valid URL. |
| 401 | `Unauthorized` | The request is missing valid session or API Key credentials. |
| 404 | `SavedItemNotFoundError` | The Saved Item does not exist for the authenticated Account. |
| 429 | `RateLimitExceeded` | The API Key exceeded its request budget. |
