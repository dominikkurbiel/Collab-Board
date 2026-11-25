# Collab Board

Real-time collaborative whiteboard. Portfolio project: code quality, clear commit history and
readable architecture matter more than shipping fast.

## Stack

- **Monorepo:** pnpm workspaces (pnpm 8, Node 20.9+)
- **apps/web:** Next.js 16 (App Router), React 19, TanStack Query
- **apps/server:** Fastify 5, tRPC 11, Zod 4
- **packages/shared:** constants shared by web and server (built to `dist/` with `tsc`)
- **Planned:** Yjs (CRDT) over WebSockets, PostgreSQL, Redis pub/sub
- **Local services:** Docker Compose (PostgreSQL 17, Redis 7)

## Commands

Run from the repo root:

```bash
pnpm dev            # builds shared, then runs web (:3000) and server (:4000)
pnpm build          # production build of everything
pnpm typecheck      # TypeScript check in all packages
pnpm format         # Prettier
pnpm services:up    # start PostgreSQL + Redis
```

## Architecture

- **API = tRPC.** Procedures live in `apps/server/src/trpc/routers/<domain>.ts` and are merged in
  `apps/server/src/trpc/router.ts`. The web app imports **only the type** `AppRouter` from
  `@collab-board/server/trpc`. Never import server runtime code into the web app.
- **Validation:** every procedure input is a Zod schema (`.input(z.object(...))`).
- **Per-request context** (`apps/server/src/trpc/context.ts`) is where the user, DB client etc. go.
- **REST is only for infrastructure:** `GET /health` stays plain HTTP for Docker / Coolify checks.
- **Web data fetching:** `useTRPC()` + TanStack Query (`useQuery(trpc.x.y.queryOptions(...))`).
  Providers are in `apps/web/src/app/providers.tsx`.
- Components are Server Components by default; add `"use client"` only where needed.
- Server source uses ESM with `.js` extensions in relative imports (NodeNext).

## Conventions

- TypeScript `strict` + `noUncheckedIndexedAccess`; no `any`.
- Code, comments, commit messages and README in **English**.
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
  One logical change per commit, so the history shows real step-by-step progress.
- Don't add a library for the whiteboard canvas itself (no tldraw/excalidraw): building it is the
  point of the project.
- Keep the README roadmap up to date when a feature is finished.

## Before finishing a task

1. `pnpm typecheck` and `pnpm build` pass.
2. `pnpm format` has been run.
3. Don't commit or push unless asked.
