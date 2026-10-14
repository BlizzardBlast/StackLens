# @stacklens/persistence

FR-100 adds nullable GitHub ownership/connection references paired by a database check, and RLS
for analysis/report/delivery readers. `withOwner` uses transaction-local identity, preserving
pooled connection isolation. Activated APIs require restricted non-owner logins, verified by
`verifyConnectedApiDatabase`. `stacklens_auth.github_connection` stores hashes and authenticated
token ciphertext outside analysis backup schemas, with bounded expired cleanup. Legacy rows/report
JSON remain unchanged; old archive readers tolerate absent owner columns. See
[GitHub connections](../../docs/implementation/github-connections.md) and ADR-0023.

PostgreSQL persistence boundary for hosted StackLens analysis delivery.

The FR-100 activation guard validates the five ownership policy definitions and applicability,
not just their count. Worker migration reconciles owned policies atomically and rejects unexpected
policies. Activation also rejects effective database/permanent-schema CREATE (including PUBLIC
grants and schemas outside the API search path), database/schema ownership and connection-table ownership.
It checks required permissions and rejects extra table/column grants, including TRUNCATE, TRIGGER,
REFERENCES and MAINTAIN, on the three analysis tables and connection storage. Effective PUBLIC
grants are included; the approved connection SELECT/INSERT/DELETE scope remains available.
Whole-row reads explicitly use `pg_catalog.to_jsonb`, preventing application-schema overloads from
running under Worker privileges. All connection reads/writes and expiry cleanup have an eight-second
total checkout/I/O deadline and a transaction-local statement timeout. Cancellation releases only
their borrowed client, including a checkout that completes late. Interrupted writes destroy the
client; healthy connections keep their ordinary timeout settings.

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

`createStackLensPool` accepts injectable pool limits, connection-use limits, connection timeouts and a CA PEM. Explicit
CA connections verify the server certificate and hostname and reject URL SSL parameters that
would replace the CA configuration. `readStackLensPoolOptions` parses runtime environment values
without including their contents in errors. API, Worker and container checks reuse this boundary;
unset hosted options retain local defaults. See the
[managed hosting settings](../../docs/implementation/managed-hosting.md#postgresql-runtime-settings).

The request-bound Vercel API sets `maxUses: 1` so a released client closes immediately instead of
waiting on an idle timer. Each acquired transaction keeps its client until release. The pool object
and finite concurrency/acquisition limits remain shared; continuous API and Worker connections keep
their normal reuse policy. This preview tradeoff adds connection/TLS overhead. See
[Vercel hosting](../../docs/implementation/vercel-api-hosting.md).

Traceability: FR-003, FR-021, DATA-006, NFR-003, NFR-008, NFR-009, SEC-003, GOV-006.
