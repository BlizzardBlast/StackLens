# Vercel API preview target

> **Status:** Adapter prepared; backend secret transfer and cloud activation pending\
> **Date:** 2026-10-02\
> **Requirements:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007, GOV-002/006/007\
> **Decision:** [ADR-0016](../adr/0016-vercel-request-bound-api.md)

## Project boundary

Use a separate Vercel Hobby project named `stacklens-api-preview`, root directory `apps/api`,
Fastify preset and Node 24. The authenticated import form exposes this separate API project;
do not choose its inferred multi-service configuration. Keep the web project separate at the
repository root with the existing `vercel.mjs`. Database secrets belong only to the API project.
Render's actual Free deployment requested card verification and created no service. The user
requires no card and no paid plan; stop if Vercel's actual activation violates that constraint.

`apps/api/vercel.json` installs the frozen pnpm lockfile, builds the API workspace dependency graph,
and selects Singapore (`sin1`) with a 60-second request limit. Enable
`ENABLE_EXPERIMENTAL_COREPACK=1` so the package-manager version is honored. Leave Output Directory
unset: the native Fastify builder traces `app.mjs`, which imports the compiled runtime.
Root `packageManager` and API `packageManager` both pin pnpm 12.4.2.

The API entrypoint has no continuous delivery timer. It shares one pool/runtime across warm requests
and attaches the pool to Fluid Compute before using it. Repository submission still commits durable
state and awaits the existing delivery attempt. The independently running Silly Worker handles
recovery, repository/provider execution and retention. Keep that Worker active.

## Runtime values

Set these private API environment values only after explicit approval to transfer credentials to
Vercel as a new backend destination:

- `DATABASE_URL`: the shared Aiven PostgreSQL URL without SSL query overrides.
- `STACKLENS_DATABASE_SSL_CA`: the actual multiline project CA PEM, with certificate verification enabled.

Set non-secret `STACKLENS_DATABASE_POOL_MAX=1`, `STACKLENS_RETENTION_HOURS=24`,
`ENABLE_EXPERIMENTAL_COREPACK=1`. No GitHub token is needed by the API. Keep database credentials
out of the web project, `VITE_*`, repository files, build arguments, screenshots and logs.
The existing pool validates the CA and rejects URL SSL overrides.

Aiven Free displays a 20-connection limit. One connection per Function instance does not bound
the number of instances. Include Worker pools, migrations, administration and deployment overlap
when observing connection usage. This target is a low-traffic personal preview; load and availability
claims require separate measurements.

## Verification and activation

Local preparation selected `app.mjs` with the real `@vercel/fastify` 12.0.0 builder and traced
Node 24 output: 1,765 files, 8,167,198 uncompressed bytes, including Graphile's embedded migrations.
The configured frozen install and workspace build commands passed. Native local HTTP checks covered
OpenAPI, malformed JSON, quick analysis, uncached submission/polling and unknown-route JSON errors.
Database-backed `pnpm check` passed 539 tests and the compiled adapter smoke. These checks do not
prove Vercel TLS, Function suspension, production networking or quotas. The
[dated evidence](release-evidence/2026-10-02-api-target.json) records these boundaries.

1. Resolve the current reviewed PR #41 HEAD. Select `codex/mvp-release-readiness`, not baseline `main`.
   Verify Hobby and the separate `apps/api` root. Confirm outside-root workspace files are available.
2. After new-destination approval, enter the two Aiven values privately and activate the API project.
   Record the actual revision, deployment identifier, region and HTTPS origin.
3. Verify `/openapi.json`, synchronous paste/upload, invalid input, uncached `202` submission and polling.
   Preserve malformed JSON and unknown-route errors as API JSON rather than SPA HTML.
4. Run both requested repositories through this public API and the existing remote Worker; validate
   reports with the shared contracts and record immutable commits, timings and limitations.
5. Point the separate web project's `STACKLENS_API_ORIGIN` at that HTTPS origin. Follow the
   [web acceptance sequence](vercel-hosting.md#preview-acceptance-sequence), including deep links.
6. Record cold/warm startup and pool behavior separately. Public preview success does not close
   remote active-job recovery, retention/restore or real screen-reader/device release gates.

Rollback keeps compatible report readers and the same database/Worker. Redeploy the preceding
reviewed API build or return to a verified portable process host. Never point the web at an
unverified origin or move analysis execution into a Function to avoid Worker limits.

## Checked references

- [Fastify deployment](https://vercel.com/docs/frameworks/backend/fastify)
- [Database pool attachment](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)
- [Native Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Existing managed resources](managed-hosting.md)
