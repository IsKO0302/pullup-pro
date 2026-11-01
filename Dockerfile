# syntax=docker/dockerfile:1
# PULLUP PRO 2.0 — one Dockerfile, two runtime targets:
#   docker build --target api -t pullup-pro-api .     # API + web app (PWA / Mini App) on :8080
#   docker build --target bot -t pullup-pro-bot .     # Telegram bot (polling or webhook)
# Usually built and started by docker-compose.yml.

ARG NODE_IMAGE=node:22-alpine

# ---------- build: install all deps, typecheck-free production builds ----------
FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/telegram-bot/package.json apps/telegram-bot/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps ./apps
COPY database ./database
RUN npm run build

# ---------- runtime dependencies only (the bundles inline @pullup/* workspace code) ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY apps/telegram-bot/package.json apps/telegram-bot/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && rm -rf packages apps

# ---------- API + web ----------
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 WEB_DIST=/app/web MIGRATIONS_DIR=/app/database/migrations
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /src/database/migrations ./database/migrations
COPY --from=build /src/apps/api/dist ./api
COPY --from=build /src/apps/web/dist ./web
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "api/server.js"]

# ---------- Telegram bot ----------
FROM ${NODE_IMAGE} AS bot
ENV NODE_ENV=production MIGRATIONS_DIR=/app/database/migrations
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /src/database/migrations ./database/migrations
COPY --from=build /src/apps/telegram-bot/dist ./bot
USER node
CMD ["node", "bot/bot.js"]
