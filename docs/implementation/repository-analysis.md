# Repository Analysis Orchestration

> **Status:** Implemented application-service baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001, NFR-003–NFR-005, NFR-008, NFR-009, SEC-001–SEC-003, SEC-007, SEC-008, GOV-007  
> **Architecture:** `apps/api|apps/worker -> @stacklens/analysis-orchestration -> provider/analyzer packages`

## Purpose

`@stacklens/analysis-orchestration` is the shared hosted application-composition boundary.

Its first service, `analyzePublicGitHubRepository`, connects the already-accepted provider and
analyzer boundaries without adding HTTP, worker-registration, or database concerns.

This keeps one authoritative long-running repository workflow reusable by the future Fastify API and
Graphile Worker without either application importing the other.

## Production analyzer composition

`productionJavaScriptAnalyzer` binds the current JavaScript/TypeScript production policy:

- dependency inventory, framework/tool, npm-health, configuration, source-usage, and scoring-coverage facts;
- overlap, deprecation, vulnerability, migration, outdated, and potentially-unnecessary findings;
- `JS-PRIORITY-016@1`;
- `JS-RECOMMEND-015@1`;
- `stackHealthScorer` / `stack-health-v1`.

The composition root owns no formula itself. Detection/priority/recommendation policy remains in
`@stacklens/rules-javascript`; numeric scoring remains in `@stacklens/scoring`.

Production identities are `javascript-production-v1`, `javascript-rules-v1`, and
`stack-health-v1`.

## Repository flow

The service performs the following bounded sequence:

1. acquire a public immutable repository snapshot through an injected GitHub provider;
2. fail clearly when the repository cannot be resolved or a supported root `package.json` is absent;
3. parse the root manifest as untrusted JSON;
4. normalize dependency declarations and package scripts without executing them;
5. create the static project snapshot from already-acquired GitHub files;
6. run bounded static source-usage parsing using the provider source-coverage state;
7. create local manifest/configuration/source evidence;
8. fetch npm Registry metadata for a deterministic bounded set of package identities;
9. submit OSV queries only for exact semantic-version declarations;
10. preserve provider sources/evidence/partial failures;
11. invoke the production analyzer;
12. return a contract-valid `AnalysisReport` plus transport-independent progress events.

Raw manifest/source/script content is not copied into the returned progress or report.

## External failure policy

GitHub repository acquisition is terminal because no normalized repository project can be built
without it.

npm Registry and OSV failures are non-terminal:

- unavailable provider sources remain in `report.sources`;
- provider failures remain in `report.partialFailures`;
- unrelated analysis still runs;
- affected rules/scoring disclose limitations or N/A rather than clean conclusions.

## Exact-version OSV policy

OSV requests are built only from declarations accepted by the same deterministic semantic-version
parser used by JavaScript rules.

Ranges, tags, URLs, workspace references, shortened versions, and other unsupported declarations are
not silently reinterpreted as installed versions. When no exact declarations exist, OSV acquisition
is skipped and existing analyzer policy reports insufficient evidence.

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
graceful npm failure, exact-version-only OSV behavior, skipped OSV for ranges, terminal GitHub
failure, missing/malformed manifests, progress delivery, report-schema validation, and sentinel
source/script non-retention.

Normal PR correctness has no live GitHub/npm/OSV dependency.

**Traceability:** FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001, NFR-003,
NFR-004, NFR-005, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-007.
