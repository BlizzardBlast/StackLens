# ADR-0002: Technology selection

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** PRD-006, PRD-007, FR-001–FR-004, FR-018–FR-022, NFR-001, NFR-002, NFR-004–NFR-009, SEC-001–SEC-003, GOV-006

## Context

StackLens needs:
- one language across web, server, worker, analyzer, and future CLI where practical;
- a browser UI optimized for a developer-tool workflow;
- a stable versioned API consumable by future non-web clients;
- deterministic static analysis that is not coupled to a web framework;
- reliable asynchronous repository analysis;
- simple self-hostable infrastructure.

## Decision

### Runtime and language

- **TypeScript 6.x**, strict mode.
- **Node.js 24 LTS** for API, worker, tooling, and future CLI.
- **ESM** modules.
- **pnpm 10** workspaces.
- **Turborepo** for workspace task orchestration/caching.

### Web

- **React 19.3**.
- **Vite 8.1**.
- **TanStack Router v1**, file-based routing.
- **TanStack Query v5** for API/server state.
- **Tailwind CSS 4.3**.
- **Zod 4** for runtime-validatable shared contracts.
- **Testing Library** for component behavior.
- **Playwright** for browser end-to-end tests.

A client-rendered Vite application is preferred over a full-stack React framework because StackLens already has a distinct API/worker architecture and the MVP does not require server rendering. This keeps the web application a replaceable client of the public API.

### API

- **Fastify 5**.
- **Zod 4** schemas through an appropriate Fastify type-provider integration.
- **OpenAPI** generated from API schemas.
- **Pino-compatible structured logging**.

Fastify is selected for its low-overhead Node server model, mature lifecycle/plugin system, schema-oriented validation/serialization, and suitability for a standalone API.

A REST/OpenAPI contract is preferred over a React/TypeScript-specific RPC protocol because **NFR-005**, **FR-108**, **FR-109**, and **FR-110** require the same product contracts to be usable by future CLI, GitHub, IDE, and potentially third-party clients.

### Persistence

- **PostgreSQL 18**.
- **Drizzle ORM stable 0.44 line** for application persistence and migrations.
- Do not adopt Drizzle 1.0 beta for production until it reaches an acceptable stable release.

PostgreSQL is the single stateful infrastructure dependency. It provides a durable base for jobs now and saved repositories/history later.

### Background jobs

- **Graphile Worker** backed by PostgreSQL.

Graphile Worker is selected to avoid introducing Redis solely for the queue. It provides a durable PostgreSQL-backed Node.js worker model and keeps the MVP infrastructure small.

### Static analysis

- **@typescript-eslint/typescript-estree** as the initial JavaScript/TypeScript parser.
- The parser sits behind an internal adapter.
- Rules must depend on StackLens AST abstractions/utilities where appropriate rather than parser-specific details everywhere.

This parser is selected for robust JavaScript/TypeScript/JSX/TSX support and a stable ESTree-shaped ecosystem. A future move to Oxc may be evaluated for performance without changing finding/report contracts.

### External evidence

- **npm Registry** for package metadata and deprecation/version information.
- **OSV.dev** for known vulnerability lookup, using batch queries where possible.
- **GitHub REST API** for public repository metadata and bounded file acquisition.

### Test/tooling

- **Vitest 4** for unit/integration tests.
- **Biome 2** for linting and formatting.
- **GitHub Actions** for CI.
- **Docker Compose** for local PostgreSQL and integration-test infrastructure.

## Alternatives considered

### Next.js / other full-stack React framework

Not selected for MVP because the product already benefits from a framework-independent API and worker. Server components/SSR are not required by accepted MVP requirements, and coupling server behavior to the frontend would provide little architectural benefit.

### tRPC-only API

Not selected because the long-term product explicitly includes non-React clients. REST/OpenAPI provides a language-agnostic public boundary.

### Redis + BullMQ

Viable, but not selected initially because it adds a second stateful infrastructure dependency when PostgreSQL is already required. The queue abstraction should remain replaceable if workload measurements later justify Redis.

### BullMQ PostgreSQL backend

Not selected initially because PostgreSQL backend support is comparatively new. Graphile Worker is purpose-built around PostgreSQL and keeps the initial queue decision conservative.

### Microservices

Not selected because they add deployment, observability, contract, and local-development overhead without a demonstrated scaling need.

### Oxc parser as the initial parser

Oxc is attractive for performance, but the initial priority is correctness and implementation velocity. The parser adapter keeps Oxc available as a future optimization.

## Version policy

The versions above describe the selected stable major/release line as of 2026-09-18. Implementation should:
- pin reproducible versions in the lockfile;
- prefer supported stable releases;
- avoid beta/RC dependencies for foundational infrastructure unless an ADR explicitly accepts that risk;
- update this ADR only for material architecture changes, not every patch release.

## Consequences

- TypeScript contracts can be shared across runtime boundaries.
- Future CLI reuse is straightforward.
- PostgreSQL is required for the hosted repository-analysis flow.
- The frontend can deploy independently as static assets.
- The analyzer remains runnable without Fastify, React, or PostgreSQL.
