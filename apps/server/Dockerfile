# Build from the repository root:  docker build -f apps/server/Dockerfile .

# ---- base: Node + pnpm (version taken from "packageManager" in package.json) ----
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- build: install, compile TypeScript, prepare a standalone production folder ----
FROM base AS build

# Manifests first: this layer (and the slow install) is cached until dependencies change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# Only the server and the workspace packages it depends on ("..." = with its dependencies)
RUN pnpm install --frozen-lockfile --filter "@collab-board/server..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @collab-board/shared build \
 && pnpm --filter @collab-board/server build \
 # Copies the server with production dependencies only (no tsx, vitest, drizzle-kit...)
 && pnpm --filter @collab-board/server deploy --prod /out

# ---- runtime: small image with just what is needed to run ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=node:node /out ./

# Don't run as root: a bug in the app can't take over the container as easily
USER node
EXPOSE 4000

# Docker / Coolify mark the container unhealthy if /health stops answering
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Runs pending database migrations on start, then serves HTTP + WebSockets
CMD ["node", "dist/index.js"]
