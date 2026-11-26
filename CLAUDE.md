# Collab Board

Real-time collaborative whiteboard. Portfolio project: code quality, clear commit history and
readable architecture matter more than shipping fast.

## Stack

- **Monorepo:** pnpm workspaces (pnpm 12 via Corepack, pinned in `packageManager`; Node 24 LTS, version in `.nvmrc`)
- **apps/web:** Next.js 16 (App Router), React 19, TanStack Query, Zustand
- **apps/server:** Fastify 5, tRPC 11, Zod 4
- **packages/shared:** types, the Yjs board document and demo content, used by web and server
  (built to `dist/` with `tsc`)
- **Real-time:** Yjs (CRDT) over WebSockets (`@fastify/websocket` + `y-protocols` on the server,
  `y-websocket` client in the browser)
- **Database:** PostgreSQL 17 with Drizzle ORM (`pg` driver), SQL migrations in `apps/server/drizzle/`
- **Stretch goal (not planned now):** Redis pub/sub for running several server instances
- **Local services:** Docker Compose (PostgreSQL 17 on host port 5433)
- **Containers & CI:** multi-stage Dockerfiles in `apps/server` and `apps/web` (build from the repo
  root); GitHub Actions in `.github/workflows/ci.yml` must stay green

## Commands

Run from the repo root:

```bash
pnpm dev            # builds shared, then runs web (:3000) and server (:4000)
pnpm build          # production build of everything
pnpm typecheck      # TypeScript check in all packages
pnpm test           # unit tests (Vitest)
pnpm format         # Prettier
pnpm services:up    # start PostgreSQL (needed by the server)
docker compose -f docker-compose.prod.yml up --build  # whole app in containers, like production
pnpm --filter @collab-board/server db:generate  # SQL migration from schema changes
```

## Architecture

- **Server = modular monolith.** Features live in `apps/server/src/modules/<name>/` (`health`,
  `realtime`, `boards`). A module imports another one **only through its `index.ts`** (its public
  API), never its internal files. Shared infrastructure: `src/db/`, `src/trpc/`. `app.ts` is the
  composition root that wires modules together.
- **API = tRPC.** Procedures live in `modules/<name>/<name>.router.ts` and are merged in
  `apps/server/src/trpc/router.ts`. The web app imports **only the type** `AppRouter` from
  `@collab-board/server/trpc`. Never import server runtime code into the web app.
- **Validation:** every procedure input is a Zod schema (`.input(z.object(...))`).
- **Per-request context** (`apps/server/src/trpc/context.ts`) is where the user, DB client etc. go.
- **REST is only for infrastructure:** `GET /health` stays plain HTTP for Docker / Coolify checks.
- **Real-time endpoint:** `GET /ws/:boardId` (WebSocket), one in-memory `Room` per board in
  `apps/server/src/modules/realtime/`. Origin and board id are checked in `preValidation`, before the upgrade.
- **Persistence:** `RoomManager` loads a room from `BoardStorage` on first connection, saves the Yjs
  state with a debounce, saves and unloads it when empty, and saves everything on shutdown.
  Realtime defines the `BoardStorage` interface (a port); the boards module implements it on
  PostgreSQL (an adapter); tests use the in-memory version.
- **Board access** (`modules/boards/`): boards have random ids and an optional argon2id-hashed
  password. Unlocking sets an httpOnly cookie with an HMAC-signed, per-board, expiring token.
  `BoardService.getAccess` is the single source of truth, used by tRPC (`boards.access`) and by
  the WebSocket `preValidation` (via the `checkAccess` port). The web `BoardGate` is only UX.
- **Tests first for domain logic:** write the failing spec (`*.test.ts`) before the implementation.
- **Database changes:** each module owns its tables in `modules/<name>/<name>.schema.ts`; edit it,
  run `db:generate`, commit the generated
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
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `ci:`, `build:`.
  One logical change per commit, so the history shows real step-by-step progress.
- Dependency permissions live in `pnpm-workspace.yaml` (`allowBuilds`, `permissions`): deny by
  default; allow a build script only when the package really needs it.
- Don't add a library for the whiteboard canvas itself (no tldraw/excalidraw): building it is the
  point of the project.
- Keep the README roadmap up to date when a feature is finished.

## Before finishing a task

1. `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
2. `pnpm format` has been run.
3. Don't commit or push unless asked.
