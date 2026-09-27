# Repository Analysis Orchestration

> **Status:** Implemented application-service baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003–FR-023, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001, NFR-003–NFR-005, NFR-008, NFR-009, SEC-001–SEC-003, SEC-007, SEC-008, GOV-007  
> **Architecture:** `apps/api|apps/worker -> @stacklens/analysis-orchestration -> provider/analyzer packages`

## Purpose

`@stacklens/analysis-orchestration` is the shared hosted application-composition boundary.

Its first service, `analyzePublicGitHubRepository`, connects the already-accepted provider and
analyzer boundaries without adding HTTP, worker-registration, or database concerns.

This keeps one authoritative long-running repository workflow reusable by the future Fastify API and
Graphile Worker without either application importing the other.

## Production analyzer composition

`productionJavaScriptAnalyzer` binds the current JavaScript/TypeScript production policy:

- dependency inventory, resolved-dependency, framework/tool, npm-health, configuration, source-usage,
  workspace identity and named inspection-check facts;
- overlap, deprecation, vulnerability, migration, outdated, potentially-unnecessary, and static
  setup findings;
- `JS-PRIORITY-016@2`;
- `JS-RECOMMEND-015@3`;
- `stackHealthScorer` / `stack-health-v3`.

The composition root owns no formula itself. Detection/priority/recommendation policy remains in
`@stacklens/rules-javascript`; numeric scoring remains in `@stacklens/scoring`.

Production identities are `javascript-production-v4`, `javascript-rules-v4`, and
`stack-health-v3`, writing schema 2.0.0 under ADR-0013. The same package exports the provider-free
quick-manifest composition so the API does not reconstruct priority or scoring policy.
Transient project metadata includes acquisition counts/completeness, acquired lockfile paths, and
lockfile normalization issue counts. These support evidence-backed setup checks; file/script bodies
remain transient and only high-level observations enter the report.

## Repository flow

The service performs the following bounded sequence:

1. acquire a public immutable repository snapshot through an injected GitHub provider;
2. fail clearly when the repository cannot be resolved or a supported root `package.json` is absent;
3. discover declared pnpm/npm/Yarn workspace members with exclusions and parse manifests as strict JSON;
4. normalize package-scoped declarations, catalog constraints, internal links and scripts without execution;
5. select and normalize at most one supported root lockfile
   (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`) when deterministically attributable;
6. resolve per-package pnpm importers, npm hoisted records or exact Yarn descriptors and create
   the static project snapshots from acquired files;
7. inspect bounded local configuration graphs, JSONC, MDX and scripts using package source ownership;
8. create local manifest/lockfile/configuration/source evidence;
9. fetch npm Registry metadata for a deterministic bounded set of package identities;
10. submit OSV queries for exact current versions established either directly by package.json or by
    matching normalized lockfile evidence;
11. preserve provider sources/evidence/partial failures;
12. invoke the production analyzer;
13. return a contract-valid `AnalysisReport` plus transport-independent progress events.

Raw manifest/source/script content is not copied into the returned progress or report.

## External failure policy

GitHub repository acquisition is terminal because no normalized repository project can be built
without it.

npm Registry and OSV failures are non-terminal:

- unavailable provider sources remain in `report.sources`;
- provider failures remain in `report.partialFailures`;
- unrelated analysis still runs;
- affected rules/scoring disclose limitations or N/A rather than clean conclusions.

## Exact-current-version and OSV policy

OSV requests are built only from exact current versions accepted by the same deterministic
semantic-version parser used by JavaScript rules.

An exact package.json declaration is sufficient by itself. A ranged declaration such as
`^19.0.0` or `~57.0.23` can also become exact-current-version evidence when a supported committed
root lockfile deterministically matches the same dependency name and exact declared specifier and
provides a supported exact semantic version.

StackLens never treats a lockfile as permission to guess:

- multiple supported lockfiles require a recognized `packageManager` hint to select one;
- package-manager mismatch, stale specifiers, malformed lockfiles, missing direct resolutions,
  unsupported link targets and non-semver resolutions remain insufficient evidence;
- lockfile source text is transient and only bounded normalized resolution facts/evidence enter the
  report.

When no exact current version can be established, OSV acquisition for that declaration is skipped
and analyzer policy reports insufficient evidence.

Internal workspace edges and peer-only compatibility declarations never become external installed
versions. Provider acquisition deduplicates npm names and OSV exact package/version pairs while
retaining each affected declaration. Missing manifests, stale catalogs/importers and truncated
discovery produce scoped limitations. Positive source references survive partial coverage; absence
cannot establish non-use until relevant package/shared coverage is complete.

## Resource bounds

The first orchestration baseline enriches at most:

- 100 unique package identities through npm Registry metadata;
- 100 unique exact package/version OSV queries.

npm Registry work runs in deterministic batches of at most four concurrent requests. Results and
progress are folded back in stable package order, avoiding both a fully serial 100-request path and
unbounded fan-out.

Selection is deterministic. Input beyond either bound remains analyzable but gains an explicit
`resource_limit` limitation; unacquired metadata never becomes negative evidence.

## Progress state

The service emits ordered progress events for repository acquisition, manifest validation, package
metadata, vulnerability data, and analyzer execution.

Metadata events contain counts/failure counts only. A callback may observe events and the same
sequence is returned with the result. Progress observers may be synchronous or asynchronous; the
orchestrator awaits each observer before advancing so a worker can durably persist ordered progress
without racing later analysis phases.

Milestone J2 now maps these events through `@stacklens/repository-jobs` into durable PostgreSQL
stages. The orchestration package itself remains persistence-independent.

## Persistence boundary

This package does not persist repository files, manifests, progress, or reports.

The implemented worker/database layer persists only job/report metadata required by the accepted
architecture and SEC-003. `@stacklens/persistence` owns the database boundary,
`@stacklens/repository-jobs` owns source-free delivery semantics, and `apps/worker` owns Graphile
execution. Transient repository content remains outside job payloads and logs.

See [Persistent Repository Analysis Jobs](repository-jobs.md).

## Verification

Synthetic tests cover complete repository → npm → OSV → analyzer → recommendation → score flow,
graceful npm failure, exact-manifest versions, lockfile-resolved ranged declarations, skipped OSV
when no exact current version is provable, terminal GitHub failure, missing/malformed manifests,
progress delivery, report-schema validation, and sentinel source/script/lockfile non-retention.

Normal PR correctness has no live GitHub/npm/OSV dependency.

Pinned acceptance fixtures record selected files from KerjaLog
`9e5f869bbcf5b9d582f8e1453395ea2c06c79f83` and Frey-ui
`6dbd184ace64d28c6a7ca7c2c75263215f4ac9bf`, with minimal synthetic npm/OSV data and test files.
They verify workspace/catalog/config/script behavior and unscored update notices; they are not
claims of full live repository or runtime testing. See the phase review for exact verification.

**Traceability:** FR-003–FR-023, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001, NFR-003,
NFR-004, NFR-005, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-007.
