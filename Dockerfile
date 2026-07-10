# --- Build stage ---
FROM node:22 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:robo-pickup-server

# --- Run stage ---
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.mjs ./server.mjs
COPY server ./server

EXPOSE 8080
CMD ["node", "server.mjs"]
