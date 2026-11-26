# Collab Board

[![CI](https://github.com/dominikkurbiel/Collab-Board/actions/workflows/ci.yml/badge.svg)](https://github.com/dominikkurbiel/Collab-Board/actions/workflows/ci.yml)

Real-time collaborative whiteboard: share a link, see each other's cursors and edit the same board live.

> 🚧 Work in progress. The project is being built step by step; see the roadmap below.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js (App Router), React, TypeScript, TanStack Query, Zustand |
| Backend  | Node.js, Fastify, tRPC, Zod, WebSockets                          |
| Sync     | Yjs (CRDT)                                                       |
| Data     | PostgreSQL (Drizzle ORM)                                         |
| Tooling  | pnpm workspaces, Docker Compose, Prettier, Vitest                |

## Project structure

```
apps/
  web/        Next.js frontend
  server/     Fastify API + WebSocket server
packages/
  shared/     Types and constants shared by web and server
```

## Getting started

Requirements: Node.js 24 (LTS, see `.nvmrc`), pnpm 8+, Docker.

```bash
pnpm install
pnpm services:up   # PostgreSQL in Docker (host port 5433)
pnpm dev           # web on :3000, server on :4000 (applies DB migrations on start)
```

Development works without a `.env` file: every setting has a local default.

### Run it like production (Docker)

Both apps have a multi-stage `Dockerfile`; `docker-compose.prod.yml` runs them with PostgreSQL.

```bash
cp .env.example .env   # then set ACCESS_TOKEN_SECRET (openssl rand -base64 48)
docker compose -f docker-compose.prod.yml up --build
```

Open http://localhost:3000. Stop `pnpm dev` first, both use ports 3000 and 4000.

### Continuous integration

Every push and pull request runs [GitHub Actions](.github/workflows/ci.yml): Prettier check,
typecheck, unit tests, production build, and a build of both Docker images.

## Roadmap

- [x] Monorepo setup (web, server, shared)
- [x] Type-safe API with tRPC + TanStack Query
- [x] Board canvas: sticky notes, pan & zoom (infinite canvas)
- [x] Shapes (rectangle, ellipse), tools and resize handles
- [x] Connectors (arrows between elements)
- [x] Real-time sync with Yjs over WebSockets
- [x] Live cursors and presence
- [x] Persistence in PostgreSQL
- [x] Create boards: anyone can create a board, optionally password-protected, and get a
      shareable link (`/board/<id>`)
- [x] CI (GitHub Actions) and Docker images
- [ ] Live demo
- [ ] Share links with view / edit permissions
- [ ] _(stretch)_ Horizontal scaling with Redis pub/sub
