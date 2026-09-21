# Persistent Repository Analysis Jobs

> **Status:** Implemented Milestone J2 baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003, FR-004, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-003, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007  
> **Architecture:** `API -> @stacklens/repository-jobs -> Graphile Worker -> apps/worker -> @stacklens/analysis-orchestration -> @stacklens/persistence`

## Purpose

Milestone J2 turns the transport-independent repository workflow into durable hosted work without
moving analysis policy into the queue, database, API, or Worker.

The slice introduces three boundaries:

- `@stacklens/persistence` owns PostgreSQL schema/repository operations;
- `@stacklens/repository-jobs` owns the minimal queue payload, enqueue contract, and progress mapping;
- `apps/worker` owns Graphile Worker execution and production provider wiring.

Fastify transport remains a later adapter.

## Durable model

The `analysis` table persists only asynchronous-delivery metadata:

- stable analysis ID and public repository URL/requested ref;
- status and coarse progress stage;
- active Graphile job ownership used to prevent duplicate/stale writes;
- immutable repository owner/name/commit once resolved;
- input fingerprint and analyzer/rule/scoring versions;
- created/started/completed/updated timestamps;
- optional retention expiry;
- typed failure summary.

The `analysis_report` table stores the final contract-valid structured report plus its schema version.

Repository source files, raw manifests, package scripts, and provider response bodies are not durable
columns and are rejected from the Graphile job payload.

## Queue contract

The Graphile task identifier is `repository_analysis`.

Its payload contains only:

- `analysisId`;
- `repositoryUrl`;
- optional `ref`.

Unknown fields are rejected. The queue uses a stable job key derived from the analysis ID, five
maximum attempts, and Graphile's `unsafe_dedupe` mode. That mode is intentional here because a
second enqueue with the same stable analysis ID represents the same logical work; replacing a locked
job would otherwise exhaust its attempts and create a competing job.

## Execution ownership and idempotency

Graphile Worker delivery is at-least-once, so the database owns the execution claim.

An analysis can be claimed when it is queued, or reclaimed by the same Graphile job ID after an
interrupted attempt. A different Graphile job cannot update progress, complete the report, or fail an
analysis currently owned by another job.

Already-terminal analyses short-circuit successfully.

## Retry behavior

Retryable provider/application failures before the final Graphile attempt:

1. reset the persisted analysis to `queued`;
2. preserve a typed retryable failure summary;
3. throw from the task so Graphile applies its retry/backoff policy.

On the final Graphile attempt, the task records StackLens `failed` state and returns successfully so
Graphile does not leave a permanently-failed queue row as the only source of truth.

Deterministic non-retryable analysis errors persist `failed` immediately.

Provider partial failures that still produce a valid report remain report partial failures and yield
`completed_with_limitations` rather than whole-job failure.

## Progress mapping

Transient orchestration progress is awaited and mapped to the public durable stages:

`queued -> resolving_repository -> collecting_snapshot -> collecting_metadata -> running_rules -> scoring -> completed|completed_with_limitations|failed`.

No source content is present in progress events.

## Runtime

`apps/worker` uses PostgreSQL 18, Drizzle ORM 0.44.x, Graphile Worker 0.18, and the existing
GitHub/npm/OSV adapters.

Worker startup applies the StackLens persistence bootstrap and Graphile Worker migrations, then runs
the repository task list against the shared PostgreSQL pool.

## Verification

The permanent quality workflow provisions PostgreSQL 18 and runs:

- PostgreSQL repository integration tests for queued/running/retry/completed/failed state;
- execution ownership and stale-job protection;
- report/reproducibility metadata persistence;
- queue payload and progress mapping tests;
- worker completion, duplicate delivery, retry, and final-attempt behavior;
- the existing build/typecheck/test/lint/format suite.

Normal analysis tests remain synthetic and do not depend on live GitHub/npm/OSV services.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-003, NFR-008,
NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.
