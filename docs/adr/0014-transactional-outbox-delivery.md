# ADR-0014: Transactional outbox for repository-analysis delivery

- **Status:** Accepted
- **Date:** 2026-09-28
- **Requirements:** FR-003, FR-004, NFR-008, NFR-009, SEC-003, GOV-006
- **Supersedes:** the separate API enqueue step described by ADR-0004; ADR-0004 otherwise remains accepted

## Context

Repository submission previously persisted an `analysis` row and then attempted to enqueue a
Graphile job. A process, network, or database failure between those operations could leave a queued
analysis with no delivery attempt, while an ambiguous enqueue outcome could not safely be treated as
either failure or success.

The public API must not expose queue identifiers, attempts, leases, source, manifest, or provider
data. It must nevertheless return an analysis ID only after there is a durable path to idempotent
delivery.

## Decision

`@stacklens/persistence` creates a queued analysis and a source-free `analysis_delivery` outbox row
in one PostgreSQL transaction. The outbox is keyed by analysis ID and retains only delivery status,
attempt count, availability time, lease token/expiry, timestamps, and delivered time. It stores no
repository source, manifest, script, provider response, secret, or Graphile job identifier.

`@stacklens/repository-jobs` owns delivery dispatch through the existing `RepositoryJobQueue` seam.
Dispatchers claim bounded batches with PostgreSQL `SKIP LOCKED`, assign a short lease, and enqueue
the existing minimal payload with its stable Graphile job key. A successful enqueue marks the outbox
row delivered. An enqueue failure, including an ambiguous outcome, returns the row to pending with
deterministic one-second exponential backoff capped at sixty seconds. Expired leases are claimable
again. Delivered rows remain until their owning analysis is removed, preventing deployment overlap
from recreating a delivery for an already-enqueued analysis.

Both API and Worker runtime composition start the same delivery pump and stop it during graceful
shutdown. Fastify routes do not perform queue SQL or expose delivery state. The Worker remains the
only executor of repository analysis.

`POST /v1/analyses/repository` returns its existing `202 { analysisId }` response after the atomic
analysis/outbox transaction commits. Public status remains `queued`; dispatch attempts, leases, and
Graphile IDs remain internal. Durable creation failure remains the only submission-time
`analysis_unavailable` case.

## Consequences

### Positive

- every accepted repository submission has a recoverable, source-free delivery record;
- API outages no longer create an acknowledged analysis without a durable delivery path;
- either healthy long-lived process can recover delivery after restart or a lease expiry;
- Graphile remains the only work queue and Worker remains the only analyzer executor;
- public polling and report contracts remain unchanged.

### Trade-offs

- PostgreSQL now owns a small additional operational table and lease/retry workflow;
- dispatch is eventually consistent after the atomic commit;
- queue delivery can be attempted more than once, so the stable Graphile key and existing execution
  ownership claim remain required.

## Verification

PostgreSQL integration tests cover atomic creation, legacy queued-analysis backfill, concurrent
claims, retry availability, expired-lease recovery, and delivered-row idempotency. Repository-job
tests cover minimal payload delivery, bounded retry, and pump shutdown. Fastify injection tests
verify `202` after durable creation even when immediate dispatch fails, and `503` only when durable
creation fails.
