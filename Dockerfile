# Цай хураах — апп (вэб) + API + realtime нэг контейнерт.
# Сервер вэб build-ийг өөрөө үйлчилдэг тул ганц URL: https://<домэйн>/

# ── 1. Expo вэб build ──
FROM node:22-slim AS web
WORKDIR /web
COPY board-game/package.json board-game/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY board-game/ ./
# API нь хуудас нээгдсэн хаяг дээр (process.env нь .env файлаас давуу)
ENV EXPO_PUBLIC_API_URL=same-origin
RUN npx expo export --platform web --output-dir /web/dist && node scripts/build-sw.mjs

# ── 2. API сервер ──
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=web /web/dist ./web
ENV WEB_DIST=/app/web PORT=4000
EXPOSE 4000
# Асах бүрт схемийг шинэчилнэ (хийгдсэн migration-ыг алгасна)
CMD ["sh", "-c", "node db/migrate.js && node src/index.js"]
