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
- **Oxlint** for JavaScript/TypeScript linting, including built-in React, TypeScript, Vitest, import, and accessibility rule coverage as enabled by project policy.
- **Oxfmt** for formatting, including import sorting, Tailwind CSS class sorting, and package.json sorting.
- **TypeScript compiler (`tsc --noEmit`)** remains the authoritative type-check step initially. Oxlint type-aware rules may be enabled, but its experimental `typeCheck` mode does not replace the compiler check until separately evaluated.
- **GitHub Actions** for CI.
- **Docker Compose** for local PostgreSQL and integration-test infrastructure.

## Alternatives considered

### Next.js / T3 Stack / TanStack Start

Re-evaluated in ADR-0005.

- **Next.js** is mature and capable, but its App Router centers server rendering, Server Components, and framework-owned server behavior that StackLens does not currently require.
- **Create T3 App / T3 Stack** is a high-quality modular scaffold around Next.js and TypeScript, but adopting it would not remove StackLens's need for a framework-independent REST/OpenAPI API and worker. Its strongest tRPC-centric benefit is less valuable when future CLI, GitHub, IDE, and third-party clients are explicit requirements.
- **TanStack Start** is architecturally attractive because it preserves TanStack Router and adds SSR/server functions/routes, but as of this decision it remains officially Release Candidate rather than stable v1.

The MVP therefore keeps React + Vite + TanStack Router. Full-stack React frameworks should be reconsidered if accepted requirements later add SSR/SEO, server-rendered public reports, or substantial framework-local server behavior.

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

## External references reviewed

The selection was checked against current upstream documentation on 2026-09-18:

- React 19.3: https://react.dev/blog/2026/09/09/react-19-3
- Vite 8.1: https://vite.dev/blog/announcing-vite8-1
- Node.js release/LTS status: https://nodejs.org/en/about/previous-releases
- Fastify latest documentation: https://fastify.dev/docs/latest/
- PostgreSQL 18 documentation: https://www.postgresql.org/docs/18/
- Graphile Worker documentation: https://worker.graphile.org/docs
- OSV API: https://google.github.io/osv.dev/api/
- TanStack Router: https://tanstack.com/router/latest/docs/quick-start
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/installation
- TypeScript 6.0: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Vitest 4: https://vitest.dev/blog/vitest-4
- Tailwind CSS 4.3: https://tailwindcss.com/blog/tailwindcss-v4-3
- Oxlint: https://oxc.rs/docs/guide/usage/linter
- Oxlint type-aware linting: https://oxc.rs/docs/guide/usage/linter/type-aware
- Oxfmt: https://oxc.rs/docs/guide/usage/formatter
- Next.js App Router: https://nextjs.org/docs/app
- Create T3 App: https://create.t3.gg/en/introduction
- TanStack Start overview: https://tanstack.com/start/latest/docs/framework/react/overview

## Consequences

- TypeScript contracts can be shared across runtime boundaries.
- Future CLI reuse is straightforward.
- PostgreSQL is required for the hosted repository-analysis flow.
- The frontend can deploy independently as static assets.
- The analyzer remains runnable without Fastify, React, or PostgreSQL.
