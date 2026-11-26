# Collab Board

Real-time collaborative whiteboard. Portfolio project: code quality, clear commit history and
readable architecture matter more than shipping fast.

## Stack

- **Monorepo:** pnpm workspaces (pnpm 8, Node 20.9+)
- **apps/web:** Next.js 16 (App Router), React 19, TanStack Query, Zustand
- **apps/server:** Fastify 5, tRPC 11, Zod 4
- **packages/shared:** types, the Yjs board document and demo content, used by web and server
  (built to `dist/` with `tsc`)
- **Real-time:** Yjs (CRDT) over WebSockets (`@fastify/websocket` + `y-protocols` on the server,
  `y-websocket` client in the browser)
- **Database:** PostgreSQL 17 with Drizzle ORM (`pg` driver), SQL migrations in `apps/server/drizzle/`
- **Planned:** Redis pub/sub
- **Local services:** Docker Compose (PostgreSQL 17 on host port 5433, Redis 7)

## Commands

Run from the repo root:

```bash
pnpm dev            # builds shared, then runs web (:3000) and server (:4000)
pnpm build          # production build of everything
pnpm typecheck      # TypeScript check in all packages
pnpm test           # unit tests (Vitest)
pnpm format         # Prettier
pnpm services:up    # start PostgreSQL + Redis (needed by the server)
pnpm --filter @collab-board/server db:generate  # SQL migration from schema changes
```

## Architecture

- **API = tRPC.** Procedures live in `apps/server/src/trpc/routers/<domain>.ts` and are merged in
  `apps/server/src/trpc/router.ts`. The web app imports **only the type** `AppRouter` from
  `@collab-board/server/trpc`. Never import server runtime code into the web app.
- **Validation:** every procedure input is a Zod schema (`.input(z.object(...))`).
- **Per-request context** (`apps/server/src/trpc/context.ts`) is where the user, DB client etc. go.
- **REST is only for infrastructure:** `GET /health` stays plain HTTP for Docker / Coolify checks.
- **Real-time endpoint:** `GET /ws/:boardId` (WebSocket), one in-memory `Room` per board in
  `apps/server/src/realtime/`. Origin and board id are checked in `preValidation`, before the upgrade.
- **Persistence:** `RoomManager` loads a room from `BoardStorage` on first connection, saves the Yjs
  state with a debounce, saves and unloads it when empty, and saves everything on shutdown.
  Realtime code depends only on the `BoardStorage` interface (Postgres in the app, in-memory in tests).
- **Database changes:** edit `apps/server/src/db/schema.ts`, run `db:generate`, commit the generated
  migration. Migrations run automatically when the server starts. Never edit applied migrations.
- **Web data fetching:** `useTRPC()` + TanStack Query (`useQuery(trpc.x.y.queryOptions(...))`).
  Providers are in `apps/web/src/app/providers.tsx`.
- **Board state is split in two:**
  - the board **document** (elements, connectors) is a Yjs `Y.Doc`, shared live with everyone on
    the board. Change it only through `applyBoardAction` and read it with `readBoard`
    (`packages/shared/src/board-doc.ts`); the web app uses it via `useBoardDocument(boardId)`;
  - **per-user UI state** (tool, viewport, selection) lives in the Zustand store
    `apps/web/src/features/board/ui-store.ts` and is never synced to other users.
- Elements store **world coordinates**; convert with the helpers in
  `apps/web/src/features/board/viewport.ts` (`screenToWorld`, `worldToScreen`, ...).
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

1. `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
2. `pnpm format` has been run.
3. Don't commit or push unless asked.
