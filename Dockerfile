# One container serves both the Go Interview website and its API.

# 1. Build the Expo web app
FROM node:24-slim AS web
WORKDIR /src/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npx expo export --platform web --output-dir dist

# 2. Compile the API
FROM node:24-slim AS api
WORKDIR /src/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npx tsc

# 3. Runtime
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8080 \
    WEB_DIST_DIR=/srv/web \
    DB_PATH=/data/go-interview.db
WORKDIR /srv/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=api /src/server/dist ./dist
COPY --from=web /src/app/dist /srv/web
VOLUME /data
EXPOSE 8080
CMD ["node", "dist/index.js"]
