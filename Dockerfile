# https://hub.docker.com/_/node
FROM node:20-bookworm AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Runner ──
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Build tools for better-sqlite3 native addon
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built frontend + server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.js .
COPY --from=builder /app/sw.js .
COPY --from=builder /app/config ./config

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
