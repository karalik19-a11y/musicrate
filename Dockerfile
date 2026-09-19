# syntax=docker/dockerfile:1.7

# ---------- 1. build: client (Vite) + server (esbuild bundle) ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# install all workspaces with dev deps (needed for vite / esbuild / tsc)
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --no-audit --no-fund

COPY shared ./shared
COPY client ./client
COPY server ./server
RUN npm run build

# ---------- 2. runtime: production deps only ----------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# built artefacts only — the server bundle is self-contained apart from node_modules
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist

# SQLite file + uploaded audio live here — mount a volume to persist them
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
