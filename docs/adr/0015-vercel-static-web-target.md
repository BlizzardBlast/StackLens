# ADR-0015: Vercel static web and portable backend target

- **Status:** Accepted target preparation; deployment pending
- **Date:** 2026-10-01
- **Requirements:** PRD-006, FR-001, FR-003, FR-004, FR-022, NFR-004, NFR-008, NFR-009, SEC-003, SEC-007, GOV-006
- **Related:** ADR-0002, ADR-0004, ADR-0014

## Context

The user selected Vercel after the local live MVP acceptance pass. The existing architecture has a
static React/Vite client, a long-running Fastify API, a Graphile Worker process and PostgreSQL.
There is no linked Vercel project or known hosted API origin in this checkout.

## Decision

Prepare Vercel for the static web client. Keep the API, Worker and PostgreSQL on a separate
provider-neutral backend, preserving the accepted durable job and transactional-delivery boundaries.
API and Worker remain continuous container processes; PostgreSQL may use a separate managed host
through a direct certificate-verified connection.
This choice does not convert the Worker to request-bound Functions, introduce Vercel Queues, or
make analyzer packages depend on Vercel.

The project root is the repository root. `vercel.mjs` exports programmatic configuration using an
operator-supplied `STACKLENS_API_ORIGIN`; no hosting SDK is needed for the plain configuration
object. The target installs the frozen pnpm lockfile and builds only the web dependency graph.
The output directory is `apps/web/dist`.

Requests under `/v1` retain that prefix when forwarded to the HTTPS API origin. `/openapi.json`
uses the same origin. API responses receive browser and CDN `no-store` directives, protecting
polling freshness and anonymous report retention. The known `/quick` and `/analyses/:analysisId`
routes load the SPA entry point on direct navigation. There is no catch-all that can turn an API
error or missing asset into HTML.

Configuration fails when the API origin is absent, malformed, loopback, uses HTTP, or includes
credentials, a path, a query or a fragment. It also rejects a separate browser API base URL.
Errors do not repeat operator-supplied values. The operator must verify the origin's reachability;
syntactic validation does not establish DNS, TLS or backend health.

Use separate preview and production environment values. Preview must point at a staging backend.
Backend database/provider secrets stay outside the Vercel web project and all `VITE_*` values.
Local `.env` files are excluded from CLI uploads. Vercel project metadata is ignored by Git.

## Consequences

The web hosting target is reviewable without linking an account or publishing a deployment.
A real preview still requires an account/project and a reachable staging API, Worker and database.
The user subsequently requested backend preparation. `Dockerfile` produces separate portable API
and Worker images through `pnpm deploy --prod`, without installing dev dependencies in the final
runtime. A separate production Compose file supplies PostgreSQL 18 and a Caddy 2 gateway with
automatic HTTPS, persistent certificate storage and no public database port. Caddy is an operational
TLS adapter; the Fastify contract and core remain replaceable. The local development Compose file
still owns only development PostgreSQL. Runtime containers use Node 24, non-root execution,
read-only filesystems, resource caps and orderly shutdown. Base images are pinned by digest.

The hosted retention default is now 24 hours from submission, configurable by the API with
`STACKLENS_RETENTION_HOURS` from 1–8760 integer hours. The Worker runs a bounded sweep on startup and
every sixty seconds after the previous sweep finishes, deleting at most 100 expired terminal rows
per sweep. Existing foreign keys cascade reports and delivery state. PostgreSQL row locks with
`SKIP LOCKED` permit concurrent maintenance without touching Graphile internals or active ownership.
Queued/running records wait until terminal state; monitor stalled jobs and cleanup backlog.
Legacy records without expiry remain unchanged and need an explicit migration policy on an existing
host. Origin API responses carry the same `no-store` directives as the Vercel route configuration.
Production API/Worker entrypoints reject missing database configuration instead of using local defaults.

The [backend runbook](../implementation/backend-hosting.md) covers secrets, TLS, backups,
rehearsal and host activation. Real DNS/TLS issuance, host provisioning and production backup/log
storage remain deployment checks; container readiness is not a deployed-release claim.

The user subsequently chose Vercel, Northflank and Aiven with a free/no-card constraint. Aiven
PostgreSQL Free was created and verified through an isolated live database. Shared pool options
now accept an explicit verified CA, positive pool limits and finite connection acquisition. URL
SSL overrides are rejected when the CA is configured. Health checks share that TLS configuration.
Northflank's actual Sandbox service form requires a card, contradicting its no-card blog guidance;
the user rejected card verification. Its project is empty, and
Railway has two configured offline services after user-completed GitHub sign-in. Startup memory
estimates exceed its recurring free credit, so it remains a trial-preview option. The Dockerfile
also supports a non-secret `STACKLENS_RUNTIME` build argument for hosts lacking target-stage
selection, with both selected runtimes verified locally against Aiven. A Silly Development Free
Node 24 Worker server was subsequently activated after explicit upload/credential authorization.
A packaging adapter loads backend runtime secrets and delegates lifecycle to the existing compiled
Worker; it does not change queue/analyzer policy. Native archive extraction preserves the production
dependency symlinks that the panel's unpacker converted to files. Remote TLS/migrations passed.
The initial anonymous KerjaLog failure prompted an approved public-only GitHub token expiring
2026-10-31; both authenticated repository runs then completed with explicit limitations. Sampled
remote memory reached 249.41 MiB of 256 MiB, leaving little measured headroom. A Render Free
Docker API target is prepared in Singapore with an explicit free plan and manual deployments.
Its blueprint passes the published schema; actual activation needs the reviewed branch and approved
Aiven credential transfer. No serverless migration is introduced. Arbitrary workload capacity,
idle wake-up and the separate public HTTPS API/Vercel path remain acceptance gates. See the
[managed setup](../implementation/managed-hosting.md). No serverless migration is implied.

The [hosting runbook](../implementation/vercel-hosting.md) defines configuration, rollout, rollback
and the evidence required before launch. New target tests run within `pnpm test` and `pnpm check`.
The [manual acceptance guide](../implementation/manual-release-validation.md) preserves the real
screen-reader and physical-device gates.

## Alternatives

A serverless migration of the API and Worker would change process lifecycle, queue delivery and
provider execution semantics. It requires a separate requirements and architecture review and is
outside this target preparation. A container-hosted static frontend remains a valid self-hosting
option; Vercel is an operational web target rather than a dependency of the core.

## References checked on 2026-10-01

- [Vercel programmatic configuration](https://vercel.com/docs/project-configuration/vercel-ts)
- [Vercel Vite hosting and SPA routes](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel external rewrites](https://vercel.com/docs/routing/rewrites)
- [Vercel build and Corepack configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel cache-control precedence](https://vercel.com/docs/caching/cache-control-headers)
- [Caddy site environment variables](https://caddyserver.com/docs/caddyfile/concepts)
- [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [pnpm deployment](https://pnpm.io/cli/deploy)
