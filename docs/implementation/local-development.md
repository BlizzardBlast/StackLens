# Local Development Runtime

> **Status:** Implemented runtime composition baseline  
> **Date:** 2026-09-22  
> **Requirements:** FR-001, FR-003, FR-004, FR-017, FR-021, FR-022, DATA-006, NFR-003, NFR-004, NFR-005, NFR-008, NFR-009, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007  
> **Decisions:** ADR-0002, ADR-0004

## Purpose

StackLens already had the accepted Web -> API -> PostgreSQL/Graphile Worker -> Worker architecture,
but K1 exposed that a fresh checkout still lacked executable API/Worker process composition. This
slice makes the existing architecture runnable without moving product policy into process bootstrap
code.

## Prerequisites

- Node.js 24;
- pnpm 12.4.2;
- Docker with Docker Compose.

## Start the full local stack

From the repository root:

```bash
pnpm install
pnpm dev:infra
pnpm dev
```

The application entrypoints resolve internal workspace packages through compiled `dist` exports.
To keep that boundary while removing the manual fresh-checkout build step, the root `pnpm dev`
script first runs `pnpm dev:prepare`. That preparation uses Turborepo filters to build only the
shared workspace dependencies of `@stacklens/api`, `@stacklens/worker`, and `@stacklens/web`,
excluding the applications themselves. Turbo caching makes repeat preparation a no-op or a small
incremental build when those outputs are already current.

The commands provide:

- PostgreSQL 18 on `127.0.0.1:55432`;
- Fastify on `127.0.0.1:3000`;
- React/Vite on `localhost:5173`;
- one Graphile Worker process with default concurrency 2.

The Vite client proxies `/v1` to the local API. The API and Worker both use the same local database.
`pnpm dev:prepare` is also available explicitly when a developer wants to refresh shared package
outputs without starting the applications.
They apply StackLens and Graphile migrations during startup, so no separate migration command is
required for a fresh local database. StackLens schema bootstrap uses a transaction-scoped PostgreSQL
advisory lock so API and Worker may initialize the same database concurrently without racing DDL.

Stop application processes with Ctrl+C and stop local infrastructure with:

```bash
pnpm dev:infra:down
```

Use `pnpm dev:infra:logs` to inspect PostgreSQL container logs.

## Environment

Local defaults match `.env.example`. Copy it to `.env` when you want checked-out local overrides; API and Worker dev/start scripts load the root `.env` automatically:

```text
DATABASE_URL=postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens
STACKLENS_API_HOST=127.0.0.1
STACKLENS_API_PORT=3000
STACKLENS_WORKER_CONCURRENCY=2

# Optional. Keep a real value secret and out of source control.
# STACKLENS_GITHUB_TOKEN=
```

The defaults are intentionally local-only convenience values. Deployed API/Worker processes should
provide an explicit `DATABASE_URL` through their environment/secret manager.

For repeated live repository analysis, `STACKLENS_GITHUB_TOKEN` can authenticate the worker's
read-only GitHub REST requests and substantially reduce anonymous-rate-limit failures. It is an
operator/developer secret for the existing public-repository flow, not a user GitHub connection:
StackLens still rejects private repositories. Store real tokens in the local environment or a secret
manager, never in `.env.example`, committed `.env` files, logs, or screenshots.

`VITE_STACKLENS_API_BASE_URL` remains optional. Leave it unset for the development proxy or
same-origin deployment.

## Runtime boundaries

### API

`apps/api/src/runtime.ts` owns infrastructure composition:

1. create a PostgreSQL pool;
2. apply StackLens persistence bootstrap;
3. initialize/migrate Graphile Worker utilities;
4. bind `DrizzleAnalysisRepository`;
5. adapt Graphile `addJob` through `@stacklens/repository-jobs`;
6. construct the existing Fastify application.

`apps/api/src/main.ts` owns only environment values, the listening socket, process signals, and
graceful shutdown.

### Worker

`apps/worker/src/runtime.ts` continues to own Graphile execution plus the accepted
GitHub/npm/OSV/orchestration composition. It now leaves OS signals to the executable process so the
runtime can close both Graphile and its PostgreSQL pool deterministically.

`apps/worker/src/main.ts` owns environment values and process shutdown only.

## Safety

Local runtime composition does not alter analysis semantics:

- the API still does not import `apps/worker`;
- the Worker remains the only process that invokes long-running repository orchestration;
- Fastify does not recalculate priority, recommendations, or scores;
- no analyzed repository scripts/builds/tests/dependencies are executed;
- repository source and raw provider bodies remain transient rather than queue/database payloads;
- the optional GitHub token is passed only to the provider request boundary and is never stored in
  analysis state or emitted by startup/shutdown logging;
- startup/shutdown logging emits error names rather than connection strings or source content.

## Verification

PostgreSQL-backed API runtime integration coverage creates the actual persistence and Graphile
queue adapters and verifies both public API execution models without live providers:

- repository submission creates durable queued state through the real Drizzle/Graphile adapters;
- quick manifest analysis runs synchronously through the composed Fastify runtime, returns a
  manifest report with explicit limitations, and does not create durable repository-analysis state.

See [MVP Acceptance Hardening](mvp-acceptance.md) for the cross-surface smoke coverage.

The repository-wide completion gate remains:

```bash
pnpm check
```
