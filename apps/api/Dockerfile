# syntax=docker/dockerfile:1.7

FROM oven/bun:1-debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/chrome-extension/package.json ./apps/chrome-extension/
COPY packages/contract ./packages/contract
RUN bun install --frozen-lockfile

FROM oven/bun:1-debian AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/api

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && arch="$(uname -m)" \
 && case "$arch" in \
      x86_64)  asset=lightpanda-x86_64-linux ;; \
      aarch64) asset=lightpanda-aarch64-linux ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /usr/local/bin/lightpanda \
      "https://github.com/lightpanda-io/browser/releases/latest/download/$asset" \
 && chmod +x /usr/local/bin/lightpanda

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY --from=deps /app/packages/contract /app/packages/contract
COPY apps/api ./

EXPOSE 3002
CMD ["sh", "-c", "bun src/migrate.ts && bun src/index.ts"]
