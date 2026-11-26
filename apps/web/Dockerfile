# Build from the repository root:  docker build -f apps/web/Dockerfile .

# ---- base: Node + pnpm (version taken from "packageManager" in package.json) ----
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- build ----
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
# The web app and its dependencies, including the server package: its source is needed
# for TYPES only (AppRouter), never at runtime
RUN pnpm install --frozen-lockfile --filter "@collab-board/web..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web

# NEXT_PUBLIC_* values are inlined into the browser JavaScript AT BUILD TIME,
# so the API address is chosen when the image is built, not when it starts
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @collab-board/shared build && pnpm --filter @collab-board/web build

# ---- runtime: Next.js "standalone" output, a minimal server with only the files it uses ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
# Static assets aren't part of standalone; they go next to the app's .next folder
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
