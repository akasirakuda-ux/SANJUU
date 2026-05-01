# --- Build stage ---
FROM node:22 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Run stage ---
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.mjs ./server.mjs

EXPOSE 8080
CMD ["node", "server.mjs"]
