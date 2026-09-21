# @stacklens/repository-jobs

Shared job-delivery semantics for hosted public-repository analysis.

This package owns the stable Graphile task identifier, minimal source-free payload, idempotent
create-and-enqueue service, Graphile-compatible queue adapter, and mapping from transient
repository-analysis progress to durable public stages. Repeated enqueues for the same stable analysis
ID use Graphile's dedupe-only job-key mode so a duplicate request cannot replace an already-running
job.

The task executor itself lives in apps/worker. Fastify may later reuse this package to create and
enqueue repository jobs without importing the worker application.

Traceability: FR-003, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-003, GOV-006.
