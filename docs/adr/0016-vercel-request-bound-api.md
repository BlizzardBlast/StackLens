# ADR-0016: Request-bound Fastify API on Vercel

- **Status:** Accepted target preparation; activation pending
- **Date:** 2026-10-02
- **Requirements:** PRD-006, FR-003, FR-004, FR-022, NFR-004, NFR-008, NFR-009, SEC-003, SEC-007, GOV-006
- **Related:** ADR-0004, ADR-0014, ADR-0015

## Context

The user requires a free preview without a payment card. Aiven PostgreSQL and the continuous Silly
Development Worker are active. The reviewed release branch was published in PR #41 and passed CI.
The approved Render Free API submission requested card verification, and the Render dashboard
subsequently confirmed that no service was created. Northflank also required a card. Repeating
provider recommendations without checking their actual activation forms does not satisfy this constraint.

Vercel now supports native Fastify applications as Node.js Functions. Repository execution is already
separate from HTTP requests: the API commits a durable analysis/delivery record, awaits one delivery
attempt, and returns the stable identifier. The Worker owns analysis execution and can recover the outbox.

## Decision

Add an optional Vercel API project with root directory `apps/api`. Keep the static web project at the
repository root, and keep its existing same-origin proxy configuration. The API project's `app.mjs`
is a native Fastify entrypoint; it imports the existing runtime composition and exports the ready,
unbound HTTP server as its default handler. Vercel owns HTTP binding. Warm requests share the
module's runtime and database pool. Do not call or await Fastify `listen()` in this entrypoint.
Keep an isolated native-entry smoke alongside the compiled runtime gate: reject application binding,
verify the HTTP server export, then bind it as the host does and check real HTTP responses.

Disable the API delivery pump only in this request-bound entrypoint. Submission still awaits the
existing dispatcher before returning; no queue work is scheduled after the response. The continuously
running Worker owns delivery retry/recovery, Graphile execution and retention maintenance. No Worker,
provider credential, provider call, score policy or analyzed repository execution moves into Functions.

Attach the PostgreSQL pool to Vercel Fluid Compute immediately after creation with `attachDatabasePool`.
The default is one connection per API instance, with the existing finite connection acquisition and
optional verified CA. Pool attachment is an injected lifecycle hook: persistence and analyzer packages
remain independent of Vercel. The existing process entrypoint keeps its delivery pump and graceful
shutdown behavior. StackLens and Graphile migrations remain idempotent startup operations.

Build the API's workspace dependency graph before the Function is traced. Use Node 24, Singapore
(`sin1`), a 60-second request limit and the existing REST/OpenAPI schemas. HTTP and provider failures
retain their public sanitized contracts. Disable request logging in this adapter; pool error logs
retain only error names.

Place `DATABASE_URL` and the Aiven CA only in the separate API project after approval for this new
credential destination. Neither belongs in the static web project or any `VITE_*` variable. The API
does not require the Worker's GitHub token. Preserve the no-card/no-paid-plan constraint during activation.

This decision supersedes ADR-0015's continuous-API-only restriction for this optional preview target.
Portable API/Worker containers and their self-hosting instructions remain supported. Accepted product
behavior, report readers, queue payloads and analyzer/scoring versions are unchanged.

## Consequences and acceptance

Function suspension cannot provide periodic delivery recovery. The Worker must remain running; its
failure can leave accepted submissions queued. Aiven Free has a measured 20-connection limit. A
one-connection pool per instance does not globally bound autoscaling; this is a low-traffic personal
preview, not a claim of production capacity or availability. Monitor connection usage and Worker memory.

Target preparation must verify entrypoint selection and the actual traced build, plus real PostgreSQL
submission with the API pump disabled. Live activation must separately prove verified TLS, cold/warm
requests, uncached polling, both requested repository reports and the web proxy. Existing Worker-only
and local container evidence does not prove these public paths. Remote active-job recovery, expiry,
backup restore and real screen-reader/device checks remain release gates.

## References checked on 2026-10-02

- [Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify)
- [Fluid database pool attachment](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)
- [Vercel Fastify builder](https://github.com/vercel/vercel/tree/main/packages/fastify)
- [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
