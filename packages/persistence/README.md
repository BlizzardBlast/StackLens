# @stacklens/persistence

PostgreSQL persistence boundary for hosted StackLens analysis delivery.

The package owns the Drizzle schema and repository operations for durable analysis status, coarse
progress, typed failure summaries, reproducibility metadata, and structured final reports.

It deliberately does not own Graphile Worker task registration or retries, Fastify transport,
provider/analyzer orchestration, or source-file/manifest/script-content retention.

Repository analysis identity is caller-supplied and stable. Creating the same analysis ID with the
same normalized repository input is idempotent; binding that ID to different input fails.

Traceability: FR-003, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-003, GOV-006.
