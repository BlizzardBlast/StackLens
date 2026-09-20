# StackLens Worker

Graphile Worker application for asynchronous public-repository analysis.

The worker consumes the shared analysis-orchestration workflow, stores only coarse job state and the
structured final report through the persistence package, awaits each durable progress write before
advancing analysis, and treats Graphile Worker's at-least-once delivery as an idempotency
requirement.

Retryable failures are returned to Graphile for retry. Deterministic terminal failures are persisted.
Repository source, manifest bodies, and script content never belong in the job payload or database.

The public payload contains only the stable analysis ID, public repository URL, and optional requested
ref.

Traceability: FR-003, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003,
GOV-006.
