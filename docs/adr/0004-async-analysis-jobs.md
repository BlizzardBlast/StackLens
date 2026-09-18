# ADR-0004: PostgreSQL-backed asynchronous repository analysis

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** FR-003, FR-021, FR-101–FR-103, DATA-006, SEC-003, SEC-004, NFR-003, NFR-008, NFR-009, GOV-006

## Context

Public repository analysis may require:
- multiple GitHub API requests;
- bounded source/config retrieval;
- package metadata lookup;
- OSV vulnerability lookup;
- static parsing;
- rule execution;
- scoring.

Keeping all of that inside one HTTP request would make the product sensitive to request timeouts, retries, client disconnects, and deployment-specific execution limits.

At the same time, StackLens should keep infrastructure minimal and self-hostable.

## Decision

Use **asynchronous jobs for repository analysis**, backed by **PostgreSQL** and processed by **Graphile Worker**.

Quick manifest analysis remains synchronous unless measurements show a need to move it to the job system.

### Repository-analysis lifecycle

1. API validates the GitHub URL.
2. API creates an analysis record with a non-guessable identifier.
3. API enqueues a repository-analysis job containing minimal metadata.
4. API returns `202 Accepted` plus the analysis identifier.
5. Worker claims the job and updates coarse progress stages.
6. Worker resolves the repository to an immutable commit and performs bounded analysis.
7. Worker writes the structured report or typed failure.
8. Web client polls the analysis endpoint until terminal state.

### Progress states

Initial states:

```text
queued
resolving_repository
collecting_snapshot
collecting_metadata
running_rules
scoring
completed
completed_with_limitations
failed
```

State transitions are server-controlled. The frontend does not infer completion from elapsed time.

### Persistence

MVP persists only what asynchronous delivery requires:
- analysis identifier;
- status/progress;
- repository coordinates;
- immutable commit SHA when resolved;
- input fingerprint;
- analyzer/rule/scoring/report schema versions;
- timestamps;
- failure/limitation summaries;
- structured final report where hosted retention permits it.

Repository source files are not stored as durable database records by default.

Any temporary local files used by a worker must be deleted after the analysis lifecycle and must not be included in logs.

### Retention

Anonymous analysis data must have a finite retention period. The exact hosted default is an operational/product launch decision and must be documented before deployment.

Retention must satisfy **SEC-003**. Private source retention, when private repository support is introduced, remains governed by **SEC-004**.

### Job payload

Job payloads should contain references, identifiers, and bounded normalized request data rather than copied repository contents.

The job must be idempotent at the analysis level so a retry does not create a logically different analysis result merely because the worker restarted.

External data may change between attempts. Therefore retrieval timestamps and provider observations remain part of **DATA-006** reproducibility metadata.

### Failure and retry policy

Retry transient infrastructure/provider failures with bounded backoff.

Do not retry:
- invalid repository URL;
- unsupported repository state;
- deterministic input validation failures;
- permanent authorization/not-found results unless provider semantics indicate otherwise.

A failure in one evidence provider may yield `completed_with_limitations` when valid unrelated analysis can still be produced (**NFR-003**).

## Why Graphile Worker

Graphile Worker is selected because:
- it is built around PostgreSQL;
- it avoids introducing Redis solely for MVP jobs;
- it supports durable background processing and retries;
- it fits the Node.js/TypeScript deployment model;
- PostgreSQL is already part of the architecture for future saved analyses/history.

The queue remains an infrastructure adapter. Analyzer packages must not depend on Graphile Worker.

## Alternatives considered

### Synchronous HTTP-only analysis

Rejected for repository analysis because it makes user experience and reliability depend on request lifetime and hosting timeouts, conflicting with **NFR-008**.

### Redis + BullMQ

Technically strong, but introduces an additional stateful dependency before it is justified.

### BullMQ PostgreSQL backend

Potentially attractive, but PostgreSQL backend support is relatively new as of this decision. It can be reconsidered later if it becomes the stronger operational choice.

### Serverless-only background execution

Not selected as the architectural baseline because provider-specific time limits and execution semantics would weaken the self-hosting direction in **PRD-006**.

## Consequences

### Positive
- durable repository analyses;
- visible progress;
- retryable transient failures;
- API process remains responsive;
- no Redis requirement;
- direct path to future monitoring/history.

### Negative
- hosted repository analysis requires PostgreSQL from the start;
- worker deployment is an additional process;
- polling introduces small repeated API traffic;
- cleanup/retention jobs are required.

These costs are preferred to coupling correctness and availability to long-running HTTP requests.
