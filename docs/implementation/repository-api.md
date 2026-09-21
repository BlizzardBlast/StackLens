# Repository Analysis HTTP Transport

> **Status:** Implemented Milestone J3 baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007  
> **Architecture:** `Fastify -> @stacklens/repository-jobs | @stacklens/persistence`; Worker execution remains `apps/worker -> @stacklens/analysis-orchestration`

## Purpose

Milestone J3 exposes the durable repository-analysis flow through the accepted REST/OpenAPI boundary
without moving provider, analyzer, priority, recommendation, scoring, queue-execution, or persistence
policy into HTTP handlers.

`apps/api` remains the application boundary. It now contains both the existing framework-independent
quick-manifest service and the Fastify adapter for asynchronous public-repository analysis.

## Submission endpoint

`POST /v1/analyses/repository` accepts a strict JSON body:

```json
{
  "repositoryUrl": "https://github.com/owner/repository"
}
```

Unknown fields are rejected.

The application service:

1. reuses `parsePublicGitHubRepositoryUrl` for authoritative supported-GitHub URL validation;
2. canonicalizes accepted `.git` suffix/trailing-slash forms;
3. generates a UUID with Node's cryptographic `randomUUID()` by default;
4. delegates record creation and queue delivery to `createRepositoryAnalysisJob`;
5. returns `202 Accepted` with only the stable `analysisId`.

The API does not expose a user-selected ref in this baseline. The durable job package still supports
an optional ref internally, but adding ref-selection to the public MVP is a separate product behavior
and is not invented by this transport slice.

## Polling endpoint

`GET /v1/analyses/:analysisId` reads through `AnalysisRepository`.

The public response contains:

- analysis ID and canonical repository URL;
- StackLens durable `status` and coarse `progressStage`;
- created/updated and applicable started/completed timestamps;
- typed failure summary only when the analysis is terminal `failed`;
- the contract-valid persisted `AnalysisReport` only for successful terminal states.

Graphile job IDs, attempts, internal queue rows, retry-pending failure details, retention internals,
source files, manifest text, scripts, provider response bodies, and secrets are not exposed.

A `completed` or `completed_with_limitations` analysis without its transactionally expected report
is treated as temporarily unavailable rather than synthesized into a successful result.

## Validation and public errors

Fastify uses Zod for request validation and response serialization.

Stable transport errors are intentionally low detail:

- `invalid_request` — request shape does not match the route schema;
- `invalid_repository_url` — URL is not a supported public HTTPS GitHub repository URL;
- `analysis_not_found` — durable analysis ID does not exist;
- `analysis_unavailable` — queue/persistence state cannot currently be served;
- `internal_error` — unexpected uncaught transport error.

Dependency errors do not return low-level database/queue/provider messages.

## OpenAPI

`@fastify/swagger` is registered before the repository routes.

The same Zod schemas used for Fastify validation/serialization are transformed into an OpenAPI 3.1
document served at:

`GET /openapi.json`

This keeps runtime behavior and the public API description synchronized.

## Dependency boundaries

The Fastify layer may depend on:

- `@stacklens/data-sources` for the already-accepted public-GitHub URL parser;
- `@stacklens/repository-jobs` for minimal durable work creation/enqueueing;
- `@stacklens/persistence` for status/report reads;
- `@stacklens/contracts` for the serialized terminal report schema.

It must not import `apps/worker`, Graphile internal tables, provider runtime adapters, or analyzer
policy.

The Worker remains responsible for consuming the queue and invoking
`@stacklens/analysis-orchestration`.

## Queue-enqueue failure edge

Analysis-row creation and Graphile enqueue are currently separate durable operations in
`createRepositoryAnalysisJob`.

If enqueueing throws, the HTTP route returns `503` and does not expose the generated analysis ID.
The API deliberately does not delete or force-fail the row because a connection failure can make the
queue commit outcome ambiguous; doing so could invalidate work that was actually committed.

This means an unreachable queued row can remain after a failed submission until operational
retention/reconciliation handles it. The accepted architecture already requires finite anonymous
retention before hosted deployment. A transactional outbox/reconciliation mechanism should be added
only as a separately reviewed reliability change rather than by coupling Fastify to Graphile SQL
internals.

## Verification

Focused Fastify injection tests cover:

- accepted URL canonicalization, durable creation, enqueueing, and `202`;
- unsupported URLs and strict unknown-field rejection before durable work;
- source-free `503` behavior when queue delivery throws;
- running durable progress without queue internals;
- completed report delivery;
- terminal typed failure delivery;
- unknown analysis `404`;
- OpenAPI publication with the repository submission/polling operations.

The repository-wide quality workflow remains the completion gate.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-001,
SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.
