# Vercel API preview target

> **Status:** Public API verified; operational release gates open\
> **Date:** 2026-10-02\
> **Requirements:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007, GOV-002/006/007\
> **Decision:** [ADR-0016](../adr/0016-vercel-request-bound-api.md)

## Project boundary

The separate [Vercel Hobby project](https://vercel.com/freys-projects/stacklens-api) is
`stacklens-api`, ID `prj_Zd0NV89v672Ru0RntrsFNZ2b7O7s`, in `freys-projects`.
It is connected to `BlizzardBlast/StackLens` and tracks `codex/mvp-release-readiness` in its
Production environment. That platform label is for this personal preview, not a release claim.
Root directory `apps/api`, Fastify, Node 24, outside-root workspace files, Fluid Compute and
Singapore and the project-level 60-second duration are saved. Ignored Build Step **Only build
production** limits builds to the reviewed release branch. The user explicitly approved transferring
the two Aiven values and activating this API; both values are saved as Secret values only in its
Production environment. The corrected native entrypoint is live at
[public API](https://stacklens-api.vercel.app). The first verified native deployment
`Fd6qZs1W8XvuG44FbqZ6upyuT4jW`, runtime commit `75bf5a2`, reached Ready in 27 seconds.
Earlier configuration/startup failures remain recorded.
Pull-request and commit comments are disabled.
Keep the web project separate at the repository root with the existing `vercel.mjs`.
Database secrets belong only to the API project.

The user requested the permanent name `stacklens-api`; the former name was
`stacklens-api-preview`. The same project ID and Aiven Secret values remain in place. The new
`stacklens-api.vercel.app` domain connects to Production, alongside the original
`project-q766o.vercel.app` compatibility alias. See the
[naming record](release-evidence/2026-10-02-project-naming.json). No secret transfer or new host is
needed for this rename.

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

The native host owns HTTP binding. Await runtime construction and Fastify readiness, then export the
unbound HTTP server as the default handler. Do not call or await Fastify `listen()` in this entrypoint:
module-scope awaiting deadlocked import, and a non-blocking call still failed during cloud binding.
A named runtime export alone is rejected by the deployed runtime. The named runtime export permits
graceful teardown in an isolated smoke process. The smoke verifies the default export is the Fastify
HTTP server and fails if application code tries to bind before the host.

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

The Vercel pool uses the constant PostgreSQL application name `stacklens-api-vercel-single-use` for source-free
connection attribution. `pg_stat_activity` can distinguish API clients from the existing Worker and
provider connections without reading SQL text, addresses or credentials. This is observability
metadata, not a global connection cap or a change to job/scoring behavior. See the
[October 3 measurements](operational-preview-validation.md) and
[preview backup policy](preview-backups.md) for bounded evidence and remaining release gates.

On October 3 the earlier `stacklens-api-vercel` pool retained six idle clients after a bounded burst
and resume despite lifecycle attachment. The request-bound adapter now fixes `maxUses: 1`, retiring
a client on release while preserving transaction ownership, pool concurrency and finite acquisition
timeouts. The shared runtime/pool object remains available for warm requests. Continuous API/Worker
clients keep normal reuse. This avoids relying on a post-response idle timer, at the cost of fresh
database connections and verified TLS handshakes. The new label distinguishes this policy during
deployment overlap. Do not terminate old sessions automatically or treat a finite burst as a global
autoscaling cap. Verify live latency, both idle intervals, durable submission and readback after
publication. The exact hosting-context cause remains unverified.

## Verification and activation

Local preparation selected `app.mjs` with the real `@vercel/fastify` 12.0.0 builder and traced
Node 24 output: 1,765 files, 8,167,198 uncompressed bytes, including Graphile's embedded migrations.
The configured frozen install and workspace build commands passed. Native local HTTP checks covered
OpenAPI, malformed JSON, quick analysis, uncached submission/polling and unknown-route JSON errors.
Database-backed `pnpm check` passed 539 tests and the compiled adapter smoke. These checks do not
prove Vercel TLS, Function suspension, production networking or quotas. The
[dated evidence](release-evidence/2026-10-02-api-target.json) records these boundaries.
The compiled smoke now also imports the real entrypoint without permitting application binding,
requires a ready unbound HTTP server, then binds and checks OpenAPI and malformed JSON. Earlier
capture replay proved the module-scope await deadlock; cloud validation exposed the handler-export
and asynchronous-binding gaps. Those failed attempts remain in the dated record.

The [public preview validation](public-preview-validation.md) now records successful OpenAPI,
malformed/unknown API JSON, uncached transient paste/upload, durable repository submissions and both
contract-valid repository reports. The separate web proxy and browser journeys pass. The
[runtime quality run](https://github.com/BlizzardBlast/StackLens/actions/runs/36947487085) passed
on `75bf5a2`; resolve the current PR HEAD before subsequent deployment.

First observed OpenAPI took 3,146 ms and the following request 58 ms. Neither is a forced cold
start or pool-suspension test. Continue measuring Function lifecycle, autoscaling connections and
Worker capacity separately. The active-job panel restart delayed KerjaLog completion to 4h 10m
after submission, so prompt recovery remains a release gap. Remote expiry/restore and real
screen-reader/device gates also remain open. Production is only the platform environment label
for this personal preview; keep the two Aiven secrets solely in the API project.

Rollback keeps compatible report readers and the same database/Worker. Keep `75bf5a2` as the first
verified native API build. Later rollback must use a verified compatible build or a verified portable
process host, not an earlier failed startup attempt. Never point the web at an unverified origin or
move analysis execution into a Function to avoid Worker limits.

## Checked references

- [Fastify deployment](https://vercel.com/docs/frameworks/backend/fastify)
- [Database pool attachment](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool)
- [Native Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)
- [Project default duration](https://vercel.com/docs/functions/configuring-functions/duration#dashboard)
- [Existing managed resources](managed-hosting.md)
