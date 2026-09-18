# ADR-0005: Web framework and frontend-tooling review

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** PRD-006, PRD-007, FR-001–FR-004, FR-022, FR-108–FR-110, NFR-002, NFR-004–NFR-008, GOV-006
- **Supersedes:** the lint/format portion of ADR-0002

## Context

Before implementation begins, the frontend/tooling choices were re-evaluated against:

- Oxlint;
- Oxfmt;
- Create T3 App / the T3 Stack;
- Next.js;
- TanStack Start.

The goal is not to maximize framework features. The selected stack should implement the accepted requirements with the least unnecessary architectural coupling while preserving the future CLI, GitHub automation, IDE integration, and open-source/self-hosting direction.

## Decision summary

| Area | Decision |
| --- | --- |
| Web framework | Keep React + Vite |
| Routing | Keep TanStack Router |
| Server state | Keep TanStack Query |
| Public application API | Keep Fastify REST/OpenAPI |
| Full-stack framework | Do not adopt for MVP |
| Linter | Switch from Biome to Oxlint |
| Formatter | Switch from Biome to Oxfmt |
| Type check | Keep `tsc --noEmit` initially |

## 1. Oxlint

### Decision

Adopt **Oxlint** as StackLens's primary JavaScript/TypeScript linter.

### Rationale

Oxlint now provides broad built-in coverage for the rule families StackLens is expected to need, including TypeScript, React, import, Vitest, and JSX accessibility rules.

It also supports type-aware linting through its tsgolint integration.

This is a good fit for a TypeScript monorepo where fast local/CI feedback is valuable.

### Guardrail

Oxlint's full type-checking mode is still documented as experimental. StackLens therefore keeps the TypeScript compiler as the authoritative type-check step initially:

```text
oxlint
tsc --noEmit
```

Type-aware Oxlint rules may be enabled independently.

Replacing `tsc --noEmit` with Oxlint type checking requires a separate measured decision.

### Plugin policy

Prefer Oxlint's built-in/native rule implementations.

JavaScript ESLint-compatible plugins may be used only where required coverage is missing and compatibility has been verified. Oxlint's JavaScript plugin system remains an evolving compatibility layer and should not become a dependency for core correctness without explicit evaluation.

## 2. Oxfmt

### Decision

Adopt **Oxfmt** as StackLens's formatter.

### Rationale

Oxfmt currently provides:
- Prettier-compatible JavaScript/TypeScript formatting behavior;
- broad repository file-format support;
- built-in import sorting;
- built-in Tailwind CSS class sorting;
- built-in `package.json` sorting;
- a familiar `--check` CI workflow.

Those capabilities reduce the number of separate formatting/sorting tools the monorepo needs.

### Consequence

Biome is no longer selected as the primary linter/formatter.

This is not a judgment that Biome is unsuitable; it is a tooling simplification decision for this project's expected TypeScript-heavy repository and CI workflow.

## 3. Next.js

### Decision

Do **not** adopt Next.js for the MVP.

### Evidence considered

Current Next.js App Router is a mature full-stack framework with:
- Server Components by default;
- Server/Client component boundaries;
- server rendering and streaming;
- route handlers and backend capabilities;
- static rendering and navigation optimizations.

### Why it is not selected

Those are valuable capabilities, but the accepted StackLens MVP does not currently require SSR, React Server Components, or framework-local API routes.

StackLens already requires a framework-independent backend boundary because:
- future CLI clients must consume the same product contracts (**FR-108**);
- GitHub automation must consume the same product contracts (**FR-109**);
- IDE integration must consume the same product contracts (**FR-110**);
- long-running repository analysis belongs in a worker rather than a frontend framework request lifecycle (**NFR-008**).

Using Next.js only as a frontend while retaining Fastify is possible, but it introduces a server-capable framework without a present requirement for its server capabilities.

### Reconsider when

Re-evaluate Next.js if requirements are accepted for:
- SEO-critical application/report routes;
- server-rendered public reports;
- extensive content/marketing pages requiring integrated metadata/image features;
- meaningful product logic that benefits specifically from the Server Component model.

## 4. Create T3 App / T3 Stack

### Decision

Do **not** use Create T3 App as StackLens's foundational scaffold.

### Evidence considered

The T3 Stack intentionally centers Next.js + TypeScript, commonly with Tailwind and optional tRPC, Drizzle/Prisma, and authentication. Create T3 App is modular rather than requiring every component.

### Why it is not selected

Several individual T3 choices already align with StackLens:
- TypeScript;
- Tailwind;
- Drizzle.

However, the primary architectural value of a conventional T3 application is tight full-stack integration around Next.js and often tRPC.

StackLens deliberately needs a language-agnostic REST/OpenAPI boundary for future non-web clients (**NFR-005**, **FR-108–FR-110**).

Using Create T3 App while removing or bypassing those core architectural benefits would make it mainly a bootstrap convenience rather than a system-architecture advantage.

The monorepo also needs a separate worker and reusable analyzer packages that do not naturally map to a conventional single T3 application scaffold.

### Reconsider when

T3 conventions may still be borrowed selectively. Individual technologies are not rejected merely because the full T3 scaffold is not selected.

## 5. TanStack Start

### Decision

Do **not** adopt TanStack Start for MVP yet.

### Evidence considered

TanStack Start is especially relevant because StackLens already selects TanStack Router.

It adds:
- SSR and streaming;
- server functions;
- server/API routes;
- middleware/context;
- full-stack builds;
- the same TanStack Router route model.

Architecturally, it is the most natural full-stack alternative for StackLens among the reviewed frameworks.

### Why it is not selected now

As of 2026-09-18, TanStack's official documentation still labels Start as **Release Candidate**. It is described as feature-complete with a stable API, but it has not reached stable v1.

ADR-0002 establishes that foundational dependencies should prefer supported stable releases and avoid beta/RC dependencies unless the project explicitly accepts the risk.

The accepted MVP requirements also do not require Start's SSR/server-function capabilities.

### Reconsider when

TanStack Start should be re-evaluated when both are true:

1. it reaches stable v1 (or StackLens explicitly accepts pre-v1 framework risk); and
2. accepted requirements create a real benefit for SSR/server routes/server functions beyond what the Vite SPA + Fastify boundary provides.

If those conditions occur, TanStack Start is the preferred full-stack framework candidate to evaluate first because StackLens already uses TanStack Router.

## 6. Why React + Vite + TanStack Router remains selected

The current selection fits the actual MVP:

- the application is highly interactive and analysis-oriented;
- the public API remains an explicit architectural product boundary;
- the worker remains independent from the frontend;
- the frontend can be statically deployed;
- route types/search parameters remain strongly modeled through TanStack Router;
- future non-web clients do not depend on frontend framework internals;
- there is no current SSR requirement.

This minimizes framework responsibilities without limiting the analyzer/product architecture.

## 7. Implementation baseline

Initial quality scripts should conceptually expose:

```text
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
```

Where:
- `lint` uses Oxlint;
- `format` uses Oxfmt;
- `typecheck` uses the TypeScript compiler initially;
- Turborepo orchestrates package/app tasks.

Exact rule configuration belongs to implementation and should prioritize correctness, accessibility, import integrity, and high-signal TypeScript rules over stylistic lint rules already handled by Oxfmt.

## External references reviewed

Reviewed on 2026-09-18:

- Oxlint: https://oxc.rs/docs/guide/usage/linter
- Oxlint type-aware linting: https://oxc.rs/docs/guide/usage/linter/type-aware
- Oxlint JS plugins: https://oxc.rs/docs/guide/usage/linter/js-plugins
- Oxfmt: https://oxc.rs/docs/guide/usage/formatter
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Create T3 App introduction: https://create.t3.gg/en/introduction
- TanStack Start overview: https://tanstack.com/start/latest/docs/framework/react/overview
- TanStack Start vs Next.js: https://tanstack.com/start/latest/docs/framework/react/start-vs-nextjs

## Consequences

### Positive

- faster dedicated lint/format tooling;
- fewer formatting/sorting dependencies;
- frontend remains simple and independently deployable;
- Fastify/OpenAPI remains a clean boundary for future clients;
- TanStack Start remains an easy future migration path if its full-stack capabilities become required.

### Negative

- StackLens does not receive SSR/Server Component benefits today;
- separate web/API apps require explicit API contract maintenance;
- Oxc tooling is evolving quickly, so version upgrades require normal compatibility checks;
- `tsc --noEmit` remains a separate CI step for now.

These tradeoffs are acceptable because they preserve stable foundations and map directly to the accepted requirements.
