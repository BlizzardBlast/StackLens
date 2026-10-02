# Vercel API preview target

> **Status:** Cloud build passed; native startup correction awaiting public revalidation\
> **Date:** 2026-10-02\
> **Requirements:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007, GOV-002/006/007\
> **Decision:** [ADR-0016](../adr/0016-vercel-request-bound-api.md)

## Project boundary

The separate [Vercel Hobby project](https://vercel.com/freys-projects/stacklens-api-preview) is
`stacklens-api-preview`, ID `prj_Zd0NV89v672Ru0RntrsFNZ2b7O7s`, in `freys-projects`.
It is connected to `BlizzardBlast/StackLens` and tracks `codex/mvp-release-readiness` in its
Production environment. That platform label is for this personal preview, not a release claim.
Root directory `apps/api`, Fastify, Node 24, outside-root workspace files, Fluid Compute and
Singapore and the project-level 60-second duration are saved. Ignored Build Step **Only build
production** limits builds to the reviewed release branch. The user explicitly approved transferring
the two Aiven values and activating this API; both values are saved as Secret values only in its
Production environment. The first cloud build failed before startup; the corrected build reached
Ready but its public OpenAPI request returned 500. No usable API has been verified yet.
Pull-request and commit comments are disabled.
Keep the web project separate at the repository root with the existing `vercel.mjs`.
Database secrets belong only to the API project.
Render's actual Free deployment requested card verification and created no service. The user
requires no card and no paid plan; stop if Vercel's actual activation violates that constraint.

`apps/api/vercel.json` installs the frozen pnpm lockfile, builds the API workspace dependency graph,
and selects Singapore (`sin1`). Set the 60-second request limit in project Settings -> Functions ->
Advanced Settings -> Default Max Duration. Do not add a `functions.app.mjs` override: the actual
cloud CLI rejects that pattern before invoking the native Fastify builder. Enable
`ENABLE_EXPERIMENTAL_COREPACK=1` so the package-manager version is honored. Leave Output Directory
unset: the native Fastify builder traces `app.mjs`, which imports the compiled runtime.
Root `packageManager` and API `packageManager` both pin pnpm 12.4.2.

The API entrypoint has no continuous delivery timer. It shares one pool/runtime across warm requests
and attaches the pool to Fluid Compute before using it. Repository submission still commits durable
state and awaits the existing delivery attempt. The independently running Silly Worker handles
recovery, repository/provider execution and retention. Keep that Worker active.

The native host intercepts HTTP `listen()` and binds the captured server after importing the entrypoint.
Do not await the Fastify listen promise at module scope: that prevents import completion and deadlocks
the host. Await runtime construction, start listening without blocking import, and keep listen failures
sanitized. Export the captured HTTP server as the default handler; a named runtime export alone is
rejected by the deployed runtime. The named runtime export permits graceful teardown in an isolated
capture smoke process. The smoke verifies the default export is the same captured HTTP server.

## Runtime values

The user approved the new Vercel destination; these private API values are saved:

- `DATABASE_URL`: the shared Aiven PostgreSQL URL without SSL query overrides.
- `STACKLENS_DATABASE_SSL_CA`: the actual multiline project CA PEM, with certificate verification enabled.

Non-secret `STACKLENS_DATABASE_POOL_MAX=1`, `STACKLENS_RETENTION_HOURS=24` and
`ENABLE_EXPERIMENTAL_COREPACK=1` are saved as Config values for this project's Production
environment. No GitHub token is needed by the API. Keep database credentials
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
The compiled smoke now also captures the real entrypoint's server without binding, requires import
completion, then binds and checks OpenAPI and malformed JSON. The previous entrypoint was captured
but did not finish importing before binding; the corrected entrypoint passed the same replay.

1. Resolve the current reviewed PR #41 HEAD. The adapter is published in `2a507cb`; its
   [quality run](https://github.com/BlizzardBlast/StackLens/actions/runs/36942657278) passed.
   Recheck `codex/mvp-release-readiness`, Hobby, `apps/api` root and outside-root workspace files.
2. Verify the saved Secret values and 60-second project duration, then deploy the reviewed release
   branch. The approved first cloud attempt `GSY6Sn1HFcDhvcHiYYV2NMDnphoE`, commit `ff4d91a`,
   failed before installation: `functions.app.mjs` did not match the CLI's API-directory patterns.
   This correction removes that override. Earlier branch tracking saved successfully; its suggested
   redeployment found no existing build. Neither message nor a reserved domain proves a usable API.
   Record the actual revision, deployment identifier, region and verified HTTPS origin.
   The corrected configuration built `f661bec` in 29 seconds as deployment
   `EMDGL6Zto5tD6Mcak5ekZSeNUygF`: one Singapore Node 24 Function, 2.61 MB and a 60-second limit.
   Its first `/openapi.json` request returned 500 with `INTERNAL_FUNCTION_INVOCATION_FAILED`
   and no application logs. Revalidate the native startup correction before using its assigned domain.
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
- [Project default duration](https://vercel.com/docs/functions/configuring-functions/duration#dashboard)
- [Existing managed resources](managed-hosting.md)
