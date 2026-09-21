# Local Development Runtime

> **Status:** Implemented runtime composition baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-004, NFR-005, NFR-008, NFR-009, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007  
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

The commands provide:

- PostgreSQL 18 on `127.0.0.1:5432`;
- Fastify on `127.0.0.1:3000`;
- React/Vite on `localhost:5173`;
- one Graphile Worker process with default concurrency 2.

The Vite client proxies `/v1` to the local API. The API and Worker both use the same local database.
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
DATABASE_URL=postgresql://stacklens:stacklens@127.0.0.1:5432/stacklens
STACKLENS_API_HOST=127.0.0.1
STACKLENS_API_PORT=3000
STACKLENS_WORKER_CONCURRENCY=2
```

The defaults are intentionally local-only convenience values. Deployed API/Worker processes should
provide an explicit `DATABASE_URL` through their environment/secret manager.

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
- startup/shutdown logging emits error names rather than connection strings or source content.

## Verification

A PostgreSQL-backed API runtime integration test creates the actual persistence and Graphile queue
adapters, submits one synthetic public repository URL, and confirms durable queued status without
starting the Worker or performing live provider requests.

The repository-wide completion gate remains:

```bash
pnpm check
```
