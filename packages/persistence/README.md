# @stacklens/persistence

PostgreSQL persistence boundary for hosted StackLens analysis delivery.

The package owns the Drizzle schema and repository operations for durable analysis status, coarse
progress, typed failure summaries, reproducibility metadata, and structured final reports.

It deliberately does not own Graphile Worker task registration or retries, Fastify transport,
provider/analyzer orchestration, or source-file/manifest/script-content retention.

Repository analysis identity is caller-supplied and stable. Creating the same analysis ID with the
same normalized repository input is idempotent; binding that ID to different input fails.

`DrizzleAnalysisRepository.purgeExpiredTerminalAnalyses` removes a bounded set of expired terminal
records with row locks and `SKIP LOCKED`. Foreign keys cascade reports and delivery rows. The query
preserves queued/running claims and legacy null-expiry records and never edits Graphile internals.
Scheduling remains in Worker runtime. See [backend hosting](../../docs/implementation/backend-hosting.md).

`createStackLensPool` accepts injectable pool limits, connection timeouts and a CA PEM. Explicit
CA connections verify the server certificate and hostname and reject URL SSL parameters that
would replace the CA configuration. `readStackLensPoolOptions` parses runtime environment values
without including their contents in errors. API, Worker and container checks reuse this boundary;
unset hosted options retain local defaults. See the
[managed hosting settings](../../docs/implementation/managed-hosting.md#postgresql-runtime-settings).

Traceability: FR-003, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-003, GOV-006.
