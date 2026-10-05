# StackLens

StackLens is a requirements-driven developer tool for understanding the health of a software stack.

The initial product focuses on JavaScript and TypeScript projects. A developer provides a `package.json` or public GitHub repository and receives a deterministic, evidence-backed report covering dependencies, vulnerabilities, tooling, configuration, migration opportunities, technical-debt priorities, and explainable stack-health scores.

## Current status

**Requirements, architecture, Design v1, production design infrastructure, Analysis Report Contract v2 with historical v1 read support, the deterministic analyzer core, JavaScript dependency inventory, npm metadata rules, known-vulnerability detection, curated dependency-overlap heuristics, static source-usage analysis, potentially-unnecessary dependency heuristics, framework/tool detection, static project-configuration inspection, deterministic migration opportunities, evidence-backed recommendations, production priority v2 and risk/readiness scoring v3, the framework-independent quick-manifest service plus Fastify/OpenAPI transport, bounded npm/OSV/public-GitHub data adapters, transport-independent public-repository analysis orchestration, transactionally delivered PostgreSQL/Graphile Worker repository jobs, the Fastify REST/OpenAPI repository-analysis transport, the React repository-analysis plus quick-manifest web flows, and automated MVP acceptance plus compiled-runtime smoke coverage are implemented.**

The canonical product and system requirements are in **[docs/requirements.md](docs/requirements.md)**.

For the current implementation sequence and fresh-session handover, see **[docs/handover.md](docs/handover.md)**.
The automated acceptance baseline is documented in
**[docs/implementation/mvp-acceptance.md](docs/implementation/mvp-acceptance.md)**.
The [September 30 live release evidence](docs/implementation/mvp-release-readiness.md) covers both
public repositories through the local web/API/worker/database stack, paste/upload, error recovery
and verified 320px layouts. It records provider limitations and the remaining real screen-reader
and physical-device checks; it does not claim a deployed release.

The [personal preview](https://stacklens-web.vercel.app) is live on Vercel Hobby with a separate
[Fastify API](https://stacklens-api.vercel.app), shared Aiven Free PostgreSQL and the continuous
Silly Development Node 24 Worker. No card or paid plan was added. Both requested repositories
completed with explicit limitations through the public API and actual web forms. Same-origin JSON
routing, transient paste/upload, native file replacement, stable deep links, evidence focus return,
terminal polling stop and 320px Chromium emulation pass. See the
[October 2 public evidence](docs/implementation/public-preview-validation.md).

The Vercel projects are named `stacklens` and `stacklens-api`. The web uses
`stacklens-web.vercel.app` because `stacklens.vercel.app` belongs to another team. Original
auto-assigned addresses remain compatibility aliases; see the
[naming record](docs/implementation/release-evidence/2026-10-02-project-naming.json).

The API native entrypoint exports a ready, unbound HTTP server; Vercel owns binding. Earlier failed
configuration and startup attempts remain in the dated evidence. Runtime commit `75bf5a2` passed
CI and the 539-test database-backed gate, including the native-entry and compiled API/Worker smokes.
[PR #41](https://github.com/BlizzardBlast/StackLens/pull/41) merged as `33de1db`; its previous
deployed head had identical tracked files. Both Vercel projects now track `main`; the October 4
follow-through below records their actual deployment verification.

Repository acceptance waits for the atomic analysis/outbox commit; immediate dispatch is best
effort and recovery belongs to the continuous Worker. A completed analysis whose report is missing
returns a retryable `503`; `404` remains reserved for an absent analysis after a bounded reread.
CI now runs the compiled native-entry/API/Worker smoke after its build with PostgreSQL 18, matching
the local `pnpm check` runtime gate. See the [API contract](docs/implementation/repository-api.md)
and [contributor verification guidance](CONTRIBUTING.md#compiled-runtime-verification).

The [managed runbook](docs/implementation/managed-hosting.md) records rejected card-required
Northflank/Render activation and the inactive credit-limited Railway candidate. The public preview
still has release gaps: an active Worker restart delayed KerjaLog completion to 4h 10m after
submission; sampled memory reached 257.36 MiB against its displayed 256 MiB limit. Immediate
recovery was subsequently fixed and verified with a hosted active-job stop/start. The same analysis
finished in 3m 13s. The final constrained Linux run completed both repositories with a 244.25 MiB
peak and no memory-limit/OOM events. Remote expiry cleanup and isolated restoration of eight stored
reports pass. See the [Worker recovery record](docs/implementation/worker-recovery.md) for exact
scope and source hashes. The recovery observations were captured on a dirty base `405b420`; the
follow-up was published through PR #41. Preserve those captures' source hashes when reviewing later revisions.
Headroom remains small. General capacity, Function suspension/global connection ceilings, full
disaster recovery and real screen-reader/device acceptance remain open. This personal preview is not
a production-readiness claim.

The [October 3 operational follow-up](docs/implementation/operational-preview-validation.md) adds
continuous Chromium/Firefox/WebKit acceptance, six successful serial hosted analyses and a fresh
four-report restore rehearsal. Labeled live measurement exposed API clients remaining idle after
requests. The deployed request-bound adapter retires each released client; both measured idle
intervals ended with zero API clients, and direct/proxied quick flows plus a fresh repository
submission passed. Connection/TLS overhead and the exact runtime revision are recorded. The
[backup policy](docs/implementation/preview-backups.md) records Aiven's existing daily backups and
the Free-plan recovery limitation. Cold-start/suspension, general capacity, disaster recovery and
manual device/screen-reader gates remain open. `pnpm check` now includes browser acceptance; install
the engines once with `pnpm exec playwright install chromium firefox webkit`.

The later [operational hardening](docs/implementation/preview-operational-hardening.md) verifies
three fresh local API instances with process freeze/resume, a bounded hosted connection burst,
eight live-provider Worker jobs at 256 MiB/0.25 CPU, and encrypted restoration of 11 preview reports
on a separate local PostgreSQL server. Synthetic copied-queue replay and expiry cleanup also pass.
Worker peak memory is 249.68 MiB, leaving little headroom. Aiven rejected the proposed shared-role
connection limit with insufficient privileges; it remains inactive. The retained archive's restore
window originally ends October 4 at 20:44 Jakarta. [PR #42](https://github.com/BlizzardBlast/StackLens/pull/42)
adds a verified refresh of the eight currently retained reports, expiring October 5 at 07:24 Jakarta. The startup
diagnostic is published through merged PR #42. Both Vercel projects now track `main`; the
[restricted API follow-up](docs/implementation/restricted-preview-api.md) is merged through PR #43
and active on the public API: a six-connection login with application read/insert access and no
owner/Graphile privileges. The seventh connection was rejected while the owner remained usable;
both requested repositories completed again through the restricted API and Worker, with explicit
limitations and zero final API clients. Older sampled deployment URLs require Vercel sign-in.
The 12-hour encrypted-backup heartbeat is active. Its first scheduled refresh passes seven matching
table fingerprints and three strict/API readbacks; the new archive expires October 5 at 20:21 Jakarta.
The [independent database recovery rehearsal](docs/implementation/independent-preview-recovery.md)
restores the private archive into temporary Neon Free PostgreSQL, serves both retained reports
through the public API/web proxy, and completes fresh `frey-ui` and `KerjaLog` Worker jobs.
The preview returns to Aiven with verified fresh delivery before the Neon project and temporary
credentials are removed. Canonical backup fingerprints now fix collation and UTC across providers;
a refreshed three-report archive passes separate-server restore and expires October 5 at 13:03 Jakarta.
Actual Function suspension, general workload capacity, managed-backup/workstation-loss recovery
and user-deferred device/spoken acceptance remain open.

The [Worker capacity milestone](docs/implementation/worker-capacity.md) adds bounded burst and
sustained-queue measurements with real provider adapters and synthetic streaming responses. An
iterative response reader preserves byte/UTF-8 limits and report semantics while lowering observed
memory in the paired synthetic burst. All tested accepted jobs finish; broader hosted capacity and
release gates remain explicit. [PR #46](https://github.com/BlizzardBlast/StackLens/pull/46) is merged
and deployed on the existing Worker; both Vercel projects are Ready at captured main `7b54820`.
Its exact-head CI and the database-backed gate pass. The original local measurements remain separate
from the [hosted rollout](docs/implementation/release-evidence/2026-10-04-capacity-rollout.json).
Both new public frey-ui/KerjaLog jobs finish with strict reports and explicit limitations. Sampled
Worker memory peaks at 169.20 MiB, total database clients at seven; final API clients are zero and
the queue is empty. A stalled panel Stop requires a verified-drained stop before installation;
deployed module hashes match and temporary deployment access is revoked.
Operator backup maintenance restores four reports with seven matching fingerprints and removes
one naturally expired archive and its dedicated key. The fresh archive expires October 5 at
21:44 Jakarta; the 12-hour heartbeat remains active. Scheduler-fired expired deletion still needs
evidence. Aiven's backend rejects the displayed Free fork, confirming that restore path is
unavailable; guaranteed Free retention remains unestablished. Actual Function suspension, general
capacity and workstation/compute-loss recovery remain open alongside deferred manual acceptance.

The [Worker lifecycle extension](docs/implementation/worker-lifecycle.md) adds source-free signal
and cleanup-stage diagnostics plus a packaged Linux restart rehearsal. Normal panel SIGINT and
native SIGTERM interruption return the same analysis for retry and preserve its completed report.
Terminating the panel's outer shell with SIGTERM remains an abrupt-exit path. The October 4 stalled
Stop is not reproduced or attributed to a confirmed cause. Hosted diagnostic activation is pending:
the panel rejects starting the unchanged Worker before Node launches and its file service returns
504. The local implementation and dated evidence remain separate from hosted acceptance.

Do not treat this README, an issue, implementation detail, or code behavior as a replacement for an accepted requirement.

## Local development

The repository is runnable end to end for both public-repository and quick-manifest analysis.

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
`pnpm dev` first prepares only the shared workspace package outputs required by those applications;
Turbo caching makes that preparation cheap when nothing relevant changed. No separate `pnpm build`
is required for the normal full-stack development flow.

The default local endpoints are:

- web: `http://localhost:5173`;
- API: `http://127.0.0.1:3000`;
- OpenAPI: `http://127.0.0.1:3000/openapi.json`.

The API and worker automatically apply the StackLens/Graphile database migrations and each starts a
source-free transactional-outbox delivery pump on startup. Local
defaults match `.env.example`; copy it to `.env` or override the process environment when a different database, host,
port, or worker concurrency is required. API and worker dev/start scripts load the root `.env` when present.

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

The production web experience uses a cool diagnostic palette, locally bundled free IBM Plex
Sans/Mono fonts, system light/dark themes, and reduced-motion-aware interaction feedback. See the
[visual refinement review](docs/design/visual-refinement.md) for its design rationale.

## Analysis contracts

The shared runtime-validatable analysis model lives in **`packages/contracts`**. It defines evidence, facts, factual/heuristic findings, separate recommendations, limitations, partial failures, and explainable score states for all future consumers.

New reports use schema **2.0.0**; strict **1.0.0** readers preserve saved reports unchanged.
See [Analysis contracts](docs/implementation/analysis-contracts.md), **ADR-0008** and **ADR-0013**.

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
priority, and named workspace inspection checks for **FR-018–FR-021**. Provider-backed rules
consume source-bound normalized analyzer metadata, and project configuration is inspected without
executing configuration code.

See [JavaScript Rules](docs/implementation/rules-javascript.md).

## Scoring policy

The concrete deterministic scorer lives in **`packages/scoring`**.

**stack-health-v3** uses evidence-based risk bands for explicit dependency deprecation and known
advisory severity. Updates, overlap and optional migrations have no numerical impact.
Maintainability, Testing and Tooling score named static setup checks with equal weight. Unknown
evidence blocks the relevant score; not-applicable checks are distinct. Overall is the applicable
mean capped by Dependencies and Security. These are product bands, not percentages of safety.

The v5 analyzer supports workspace manifests, pnpm catalogs/importers, JSONC, MDX, bounded local
configuration imports and script delegation. It supplies checklists, package scopes and linked
explanations to the report. Opaque presets and dynamic commands retain precise limitations.

Saved reports retain their original scores. Restart the applications and request a new analysis to
use v3. Deploy compatible readers before enabling writers; rollback must keep schema 2 support.
See [Scoring Policy v3](docs/implementation/scoring.md), **ADR-0013**, and the
[phase reviews and acceptance record](docs/implementation/workspace-inspection.md).

## Quick manifest application boundary

The first API-application slice lives in **`apps/api`**.

It accepts pasted or uploaded `package.json` content through one authoritative in-process service,
returns stable validation errors for invalid input, creates a deterministic content fingerprint,
reuses the JavaScript manifest normalizer/evidence rule, and invokes analyzer-core without
introducing persistence, authentication, provider I/O, or scoring policy.

Fastify exposes the same service through synchronous `POST /v1/analyze/manifest`. The strict
versioned request contract supports `paste` and `upload` semantics, returns a contract-valid
`AnalysisReport`, publishes through the existing OpenAPI document, and does not add persistence or
background jobs.

The React web client exposes this contract at `/quick` with pasted and local-file input modes,
accessible synchronous request state, authoritative server-error preservation, runtime report
validation, and explicit manifest-only evidence limits. The selected local file is read in the
browser and submitted through the existing JSON upload shape; the web client adds no multipart
transport or second analysis path.

See [Quick Manifest Analysis](docs/implementation/quick-manifest-analysis.md) and
[Quick Analysis Web Flow](docs/implementation/quick-analysis-web.md).

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

PostgreSQL atomically stores a submitted analysis with a source-free delivery record, while Graphile
Worker executes the existing shared repository orchestration. API and Worker runtime pumps can
recover leased pending delivery through the stable Graphile job key. Durable progress is coarse and
source-free, execution is protected against stale/duplicate jobs by an active job ownership claim,
and final reports preserve the existing contract/version metadata.

The permanent quality workflow provisions PostgreSQL 18 for persistence integration coverage.

See [Persistent Repository Analysis Jobs](docs/implementation/repository-jobs.md), **ADR-0004**,
and **ADR-0014**.

## Repository analysis API transport

The hosted repository-analysis HTTP boundary now lives in **`apps/api`**.

Fastify validates and canonicalizes supported public GitHub repository URLs, generates a non-guessable
analysis identifier, atomically creates the analysis plus its internal delivery record through
`@stacklens/repository-jobs`, and returns `202 Accepted`. Clients poll `GET /v1/analyses/:analysisId`; that endpoint reads only
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

Its npm Registry adapter performs bounded package-metadata acquisition with redirect blocking. Its OSV adapter performs
bounded exact-version vulnerability queries and now records query-level provenance even when a
complete exact-version query returns zero known vulnerability matches. Its public GitHub adapter validates supported repository
URLs, resolves an immutable commit SHA, enumerates a bounded recursive tree, and fetches only the
root manifest, supported configuration files, and bounded JS/TS/JSX/TSX source files by immutable blob SHA while exposing whether source acquisition was complete enough for absence-based analysis.

All adapters block redirects, associate observations with explicit provenance/retrieval time, and convert provider,
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
