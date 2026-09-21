# StackLens

StackLens is a requirements-driven developer tool for understanding the health of a software stack.

The initial product focuses on JavaScript and TypeScript projects. A developer provides a `package.json` or public GitHub repository and receives a deterministic, evidence-backed report covering dependencies, vulnerabilities, tooling, configuration, migration opportunities, technical-debt priorities, and explainable stack-health scores.

## Current status

**Requirements, architecture, Design v1, production design infrastructure, Analysis Report Contract v1, the deterministic analyzer core, JavaScript dependency inventory, npm metadata rules, known-vulnerability detection, curated dependency-overlap heuristics, static source-usage analysis, potentially-unnecessary dependency heuristics, framework/tool detection, static project-configuration inspection, deterministic migration opportunities, evidence-backed recommendations, production priority/scoring policy v1, the framework-independent quick-manifest API boundary, bounded npm/OSV/public-GitHub data adapters, transport-independent public-repository analysis orchestration, persistent PostgreSQL/Graphile Worker repository jobs, the Fastify REST/OpenAPI repository-analysis transport, and the first React repository-analysis web flow are implemented. The quick-manifest HTTP route and quick-analysis web flow are not yet implemented.**

The canonical product and system requirements are in **[docs/requirements.md](docs/requirements.md)**.

For the current implementation sequence and fresh-session handover, see **[docs/handover.md](docs/handover.md)**.

Do not treat this README, an issue, implementation detail, or code behavior as a replacement for an accepted requirement.

## Local development

The repository is runnable end to end for the public-repository flow.

Prerequisites:

- Node.js 24;
- pnpm 12.4.2;
- Docker with Docker Compose.

From the repository root:

```bash
pnpm install
pnpm dev:infra
pnpm dev
```

This starts PostgreSQL 18 in Docker and runs the web, API, and worker as normal workspace processes.
The default local endpoints are:

- web: `http://localhost:5173`;
- API: `http://127.0.0.1:3000`;
- OpenAPI: `http://127.0.0.1:3000/openapi.json`.

The API and worker automatically apply the StackLens/Graphile database migrations on startup. Local
defaults match `.env.example`; copy or override those variables when a different database, host,
port, or worker concurrency is required.

Stop the application processes with Ctrl+C, then stop PostgreSQL with:

```bash
pnpm dev:infra:down
```

See [Local Development Runtime](docs/implementation/local-development.md) for runtime boundaries,
environment variables, and troubleshooting.

## MVP

The MVP is defined by the accepted requirements in `docs/requirements.md`. At a high level, it must support:

- pasted or uploaded `package.json` analysis;
- public GitHub repository analysis;
- dependency inventory;
- outdated dependency detection;
- deprecated/unmaintained dependency detection;
- overlapping/redundant dependency detection;
- potentially unnecessary dependency detection when sufficient evidence exists;
- dependency health signals;
- known vulnerability detection;
- framework/tool detection;
- project configuration detection;
- migration opportunities;
- evidence-backed recommendations;
- prioritized technical-debt actions;
- explainable overall and category health scores;
- explicit limitations and uncertainty.

AI/LLMs are **not required for MVP analysis**. The core analyzer is deterministic/static and evidence-driven (**PRD-002**, **NFR-001**).

StackLens must not execute arbitrary analyzed repository code, package scripts, builds, tests, hooks, or dependency installation as part of MVP analysis (**SEC-001**).

## Long-term direction

StackLens is intended to evolve into whole-repository intelligence covering:

`dependencies → configuration → source → architecture → tests → CI/CD → security → performance → technical debt`

Future product surfaces include authenticated/private GitHub analysis, history and monitoring, migration automation, CLI, GitHub automation, and IDE integration. See **FR-100 through FR-118** for accepted future requirements.

The intended product model is an **open-source core with a hosted SaaS experience** (**PRD-006**).

## Requirements-driven development

Per **GOV-002**, every product issue, implementation task, pull request, and acceptance test must reference at least one applicable requirement ID.

If proposed behavior is not covered by an accepted requirement, update the requirement before or in the same pull request as the implementation (**GOV-003**).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [documentation governance](docs/documentation-governance.md) for the required documentation/journey update rules (**GOV-007**).

## Architecture

The accepted system architecture is documented in **[docs/architecture.md](docs/architecture.md)**, with individual decisions recorded under **[docs/adr/](docs/adr/)**.

The initial architecture is a TypeScript modular monolith with a reusable deterministic analyzer core, React/Vite web client, Fastify API, PostgreSQL-backed worker flow, and explicit npm/OSV/GitHub evidence adapters. Architecture choices are subordinate to the requirements (**GOV-006**).

## Product design

The **StackLens Product Design v1** baseline is documented under **[docs/design/](docs/design/README.md)**.

The repository contains:

- product-design principles and requirement traceability;
- MVP information architecture and user flows;
- low-fidelity wireframes;
- the StackLens design-system specification;
- DTCG-style platform-neutral design tokens;
- an accepted Design v1 review and disposable coded prototype at `design/prototype/`;
- a chronological project journey in `docs/design/journey.md`.

StackLens owns its visual language and domain components. shadcn/ui + Base UI are selected only as the implementation foundation for generic accessible primitives; they do not define the product's visual identity (**ADR-0006**).

The production design layer now lives in **`packages/design-tokens`** and **`packages/ui`**. See [Design infrastructure implementation](docs/implementation/design-infrastructure.md) and **ADR-0007**.

## Analysis contracts

The shared runtime-validatable analysis model lives in **`packages/contracts`**. It defines evidence, facts, factual/heuristic findings, separate recommendations, limitations, partial failures, and explainable score states for all future consumers.

See [Analysis Contracts v1](docs/implementation/analysis-contracts.md) and **ADR-0008**.

## Analyzer core

The reusable deterministic execution layer lives in **`packages/analyzer-core`**. It provides staged fact → finding-candidate → priority → recommendation orchestration, rule/reference isolation, priority and scoring dependency inversion, and contract-validated report assembly without provider or UI coupling.

See [Analyzer Core](docs/implementation/analyzer-core.md) and **ADR-0009**.

## JavaScript analysis rules

The first ecosystem-specific analysis package lives in **`packages/rules-javascript`**.

It currently implements deterministic `package.json` dependency normalization, explicit project
evidence, **FR-005** dependency inventory, **FR-006** exact-version outdated detection, **FR-007**
explicit npm deprecation detection, **FR-008** curated dependency-overlap heuristics, neutral
**FR-009** bounded static source-usage analysis and potentially-unnecessary dependency heuristics,
**FR-010** npm Registry health facts, **FR-011** known-vulnerability detection, **FR-012**
framework/tool detection, **FR-013** static configuration detection, **FR-014** major-version
migration opportunities, **FR-015** evidence-backed recommendations, **FR-016** deterministic
priority, and explicit category scoring-coverage facts for **FR-018–FR-021**. Provider-backed rules
consume source-bound normalized analyzer metadata, and project configuration is inspected without
executing configuration code.

See [JavaScript Rules](docs/implementation/rules-javascript.md).

## Scoring policy

The concrete deterministic scorer lives in **`packages/scoring`**.

Scoring policy v1 uses finalized finding priority to produce evidence-linked deductions only when an
ecosystem coverage fact proves the category is supported. Dependencies and Security are numeric when
their evidence is complete; Maintainability, Testing, and Tooling remain N/A instead of receiving
invented penalties. The overall score is available only when both currently supported numeric
categories are available.

See [Scoring Policy v1](docs/implementation/scoring.md) and **ADR-0011**.

## Quick manifest application boundary

The first API-application slice lives in **`apps/api`**.

It accepts pasted or uploaded `package.json` content through one authoritative in-process service,
returns stable validation errors for invalid input, creates a deterministic content fingerprint,
reuses the JavaScript manifest normalizer/evidence rule, and invokes analyzer-core without
introducing persistence, authentication, provider I/O, or scoring policy.

The quick-manifest service remains framework-independent; its dedicated Fastify route is still a later bounded transport slice.

See [Quick Manifest Analysis](docs/implementation/quick-manifest-analysis.md).

## Repository analysis orchestration

The shared hosted-analysis composition layer lives in **`packages/analysis-orchestration`**.

It resolves a bounded public GitHub snapshot through the provider boundary, normalizes the transient
manifest/source snapshot, collects bounded npm/OSV metadata, preserves provider partial failures,
invokes the production JavaScript rule/prioritization/recommendation/scoring composition, and returns
transport-independent progress plus a contract-valid report.

This package deliberately contains no Fastify routes, Graphile Worker registration, PostgreSQL
persistence, or React behavior, so API and Worker processes can reuse the same application workflow.

See [Repository Analysis Orchestration](docs/implementation/repository-analysis.md).

## Persistent repository jobs

The hosted repository-analysis delivery boundary now spans **`packages/persistence`**,
**`packages/repository-jobs`**, and **`apps/worker`**.

PostgreSQL stores only durable analysis/report metadata, while Graphile Worker executes the existing
shared repository orchestration. Durable progress is coarse and source-free, execution is protected
against stale/duplicate jobs by an active job ownership claim, and final reports preserve the
existing contract/version metadata.

The permanent quality workflow provisions PostgreSQL 18 for persistence integration coverage.

See [Persistent Repository Analysis Jobs](docs/implementation/repository-jobs.md) and **ADR-0004**.

## Repository analysis API transport

The hosted repository-analysis HTTP boundary now lives in **`apps/api`**.

Fastify validates and canonicalizes supported public GitHub repository URLs, generates a non-guessable
analysis identifier, creates/enqueues work through `@stacklens/repository-jobs`, and returns
`202 Accepted`. Clients poll `GET /v1/analyses/:analysisId`; that endpoint reads only
`@stacklens/persistence` state and returns coarse progress, terminal failure, or the persisted
contract-valid report without exposing Graphile Worker internals.

The same Zod route schemas generate the public OpenAPI 3.1 document at `/openapi.json`.

See [Repository Analysis HTTP Transport](docs/implementation/repository-api.md) and **ADR-0002** /
**ADR-0004**.

## Repository analysis web flow

The first production web application lives in **`apps/web`**.

React 19 + Vite provide the client runtime, TanStack Router owns the stable analysis route, and
TanStack Query polls the public J3 API contract until repository analysis reaches a terminal state.
The UI shows only the durable coarse progress stage, distinguishes total failure from
`completed_with_limitations`, validates terminal reports with `@stacklens/contracts`, and reuses
`@stacklens/ui` for findings, evidence coverage, and limitations.

The browser does not call GitHub/npm/OSV directly, inspect Graphile tables, or recalculate analyzer
priority/scoring policy.

See [Repository Analysis Web Flow](docs/implementation/repository-web.md) and **ADR-0005**.

## External data sources

The first provider package lives in **`packages/data-sources`**.

Its npm Registry adapter performs bounded package-metadata acquisition. Its OSV adapter performs
bounded exact-version vulnerability queries and now records query-level provenance even when a
complete exact-version query returns zero known vulnerability matches. Its public GitHub adapter validates supported repository
URLs, resolves an immutable commit SHA, enumerates a bounded recursive tree, and fetches only the
root manifest, supported configuration files, and bounded JS/TS/JSX/TSX source files by immutable blob SHA while exposing whether source acquisition was complete enough for absence-based analysis.

All adapters associate observations with explicit provenance/retrieval time and convert provider,
network, schema, and material partial-acquisition states into typed failures/limitations. Analyzer
rules perform no provider I/O.

See [External Data Sources](docs/implementation/data-sources.md).

## Requirement examples

- `FR-006` — outdated dependency detection
- `FR-011` — known vulnerability detection
- `FR-015` — evidence-backed recommendations
- `SCORE-001` — deterministic scoring
- `SEC-001` — never execute analyzed repository code
- `NFR-002` — rule-level testability
- `GOV-002` — trace every product change

## License

See [LICENSE](LICENSE).
