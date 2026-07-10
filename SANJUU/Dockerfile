# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true

COPY package.json package-lock.json .npmrc ./
COPY web/package.json web/package.json
COPY ws/package.json ws/package.json
RUN npm ci

COPY scripts scripts
COPY web web
COPY ws ws
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY web/package.json web/package.json
COPY ws/package.json ws/package.json
RUN npm ci --omit=dev

COPY --from=builder /app/ws/dist ./ws/dist
COPY --from=builder /app/web/.next/standalone ./web/.next/standalone
COPY --from=builder /app/web/.next/static ./web/.next/static
COPY scripts/copy-next-static.mjs scripts/prod-relay.mjs scripts/prod-start.mjs ./scripts/

RUN node scripts/copy-next-static.mjs

CMD ["node", "scripts/prod-start.mjs"]
