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


## Development runtime

Start PostgreSQL and all local applications from the repository root:

```bash
pnpm dev:infra
pnpm dev
```

The root `pnpm dev` command prepares the shared workspace outputs required by the applications before
starting the watch processes; Turbo reuses cached builds when possible.

Or run only the worker after PostgreSQL is available and shared outputs have been prepared (for
example with `pnpm dev:prepare`):

```bash
pnpm --filter @stacklens/worker dev
```

The worker defaults to the local Compose `DATABASE_URL` and concurrency 2. Override
`DATABASE_URL` or `STACKLENS_WORKER_CONCURRENCY` through the process environment when needed.
Hosted databases also accept `STACKLENS_DATABASE_SSL_CA` (actual multiline CA PEM) and
`STACKLENS_DATABASE_POOL_MAX` (positive integer). Remove URL SSL parameters when supplying the
explicit CA. The managed preview starts with a pool of five and concurrency one; database/provider
secrets remain backend-only. See [managed hosting](../../docs/implementation/managed-hosting.md).

`STACKLENS_GITHUB_TOKEN` is optional. When present, the worker uses it only to authenticate
read-only GitHub REST requests for the already-supported **public repository** analysis flow, which
raises the provider rate-limit ceiling. The token is not persisted, logged, returned by the API, or
used to enable private-repository access; private repositories remain rejected by the MVP provider
boundary. Leave the variable unset to keep anonymous public GitHub access.

The runtime owns Graphile/StackLens migrations and provider composition; the process entrypoint owns
signals and graceful shutdown.

Worker runtime starts bounded expired-terminal cleanup on startup and every sixty seconds after
the prior sweep. It preserves queued/running claims and cascades reports/delivery rows through the
persistence boundary. Shutdown waits for active maintenance before closing the pool. Retention
errors are logged by name only. The compiled smoke explicitly disables retention cleanup so it
does not delete existing rows. Production startup requires `DATABASE_URL`. See
[backend hosting](../../docs/implementation/backend-hosting.md).
