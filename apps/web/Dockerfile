# syntax=docker/dockerfile:1.7

FROM oven/bun:1-debian AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ARG VITE_WEB_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WEB_BASE_URL=$VITE_WEB_BASE_URL

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/contract ./packages/contract
RUN cd apps/web && bun install --frozen-lockfile

COPY apps/web ./apps/web
RUN cd apps/web && bun run build

FROM oven/bun:1-debian AS runtime
WORKDIR /app
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/apps/web/node_modules ./node_modules
COPY --from=build /app/apps/web/favicon.ico ./
COPY --from=build /app/apps/web/server.ts ./
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "server.ts"]
