# Collab Board

Real-time collaborative whiteboard: share a link, see each other's cursors and edit the same board live.

> 🚧 Work in progress. The project is being built step by step; see the roadmap below.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js (App Router), React, TypeScript, TanStack Query, Zustand |
| Backend  | Node.js, Fastify, tRPC, Zod, WebSockets _(planned)_              |
| Sync     | Yjs (CRDT) _(planned)_                                           |
| Data     | PostgreSQL, Redis _(planned)_                                    |
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

Requirements: Node.js 20.9+, pnpm 8+, Docker.

```bash
pnpm install
cp .env.example .env
pnpm services:up   # PostgreSQL + Redis
pnpm dev           # web on :3000, server on :4000
```

## Roadmap

- [x] Monorepo setup (web, server, shared)
- [x] Type-safe API with tRPC + TanStack Query
- [x] Board canvas: sticky notes, pan & zoom (infinite canvas)
- [x] Shapes (rectangle, ellipse), tools and resize handles
- [x] Connectors (arrows between elements)
- [ ] Real-time sync with Yjs over WebSockets
- [ ] Live cursors and presence
- [ ] Persistence in PostgreSQL
- [ ] Horizontal scaling with Redis pub/sub
- [ ] Share links with view / edit permissions
- [ ] CI (GitHub Actions) and Docker images
- [ ] Live demo
