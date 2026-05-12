# Redis for API Key Rate Limits

Sleevy will use Redis for v1 API Key rate limiting instead of Postgres writes or Better Auth's built-in database-backed limiter. API Keys have a uniform 20 requests per minute budget across the v1 REST API, with HTTP 429 responses carrying `Retry-After` and rate-limit headers; Redis keeps the short-lived counters out of product data storage and works across multiple API instances. If Redis is unavailable, the limiter fails open with warning logs so legitimate API consumers can continue using Sleevy while abuse protection is temporarily weaker.
