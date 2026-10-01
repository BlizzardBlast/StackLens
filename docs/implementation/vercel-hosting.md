# Vercel web hosting target

> **Status:** Prepared locally; no linked project or deployment\
> **Date:** 2026-10-01\
> **Requirements:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-003/007, GOV-002/006/007\
> **Decision:** [ADR-0015](../adr/0015-vercel-static-web-target.md)

## Runtime topology

Vercel serves the static web client and proxies its public REST requests:

```text
Browser -> Vercel static web
                /v1 and /openapi.json -> HTTPS Fastify API
                                            -> PostgreSQL
                                  Graphile Worker -> PostgreSQL
                                       -> GitHub/npm/OSV
```

API and Worker are ordinary long-running Node 24 processes under ADR-0002/0004/0014.
PostgreSQL must be shared by those processes. A separately managed database requires a direct
certificate-verified TLS connection; a self-hosted database can remain on the host's private network.
The web project has no database or provider credentials. The existing local `compose.yaml` continues
to own only development PostgreSQL.

## Free-plan fit

Checked on 2026-10-01: [Vercel Hobby](https://vercel.com/docs/plans/hobby) is free within its quotas
and restricted to personal, non-commercial use. It fits a personal preview of this static frontend.
Confirm plan eligibility before a commercial hosted launch.

Vercel also [supports Fastify APIs](https://vercel.com/docs/frameworks/backend/fastify), deployed
as Functions. The current API needs invocation-safe runtime composition before that deployment;
its delivery pump and the continuously polling Graphile Worker are process-based. Hobby Functions
have a [300-second maximum duration](https://vercel.com/docs/functions/configuring-functions/duration).
Moving the backend to Vercel requires an external Worker host or a reviewed migration to a durable
Workflow/queue execution model, plus suitable PostgreSQL hosting. It is a separate architecture
change under ADR-0004/0015, not activation of the prepared container target.

The user now requires no payment card. The [managed setup](managed-hosting.md) records the created
Aiven Free database, activated Silly Worker, Northflank's actual card-verification blocker and
inactive credit-limited Railway candidate. The [Render Free API target](render-hosting.md) is
prepared but not deployed; its HTTPS origin and cold-start behavior remain unverified. Oracle's
card verification excludes it under the current constraint.

## Tracked configuration

- `vercel.mjs` loads the configuration from `scripts/vercel-config.mjs`.
- Install: `pnpm install --frozen-lockfile`.
- Build: `pnpm exec turbo run build --filter=@stacklens/web...`.
- Static output: `apps/web/dist`.
- API rewrites preserve `/v1`; OpenAPI forwards to the same configured origin.
- Direct visits to `/quick` and `/analyses/:analysisId` load `index.html`.
- API responses use `Cache-Control: private, no-store`, `CDN-Cache-Control: no-store` and
  `Vercel-CDN-Cache-Control: no-store`. Do not add CDN caching to analysis status/report responses.
- `.vercelignore` excludes local environment files, dependencies, cached build output, documents and
  disposable prototype code from CLI uploads. Canonical design tokens and workspace source remain
  build inputs. Git integration uploads tracked repository files, so keep secrets untracked as well.

Origin validation accepts an HTTPS origin with an optional trailing slash and rejects credentials,
paths, queries, fragments and loopback addresses. Its errors never echo supplied values.
It does not resolve DNS or prove that an origin is public or reachable.

## Vercel project settings

Import `BlizzardBlast/StackLens` into the intended Vercel account/team when publication is authorized.
Use the repository root (`.`), not `apps/web`, so configuration, the pnpm lockfile, Turbo and shared
packages remain in the build context. Select the **Vite** preset and **Node.js 24.x**.
The checked-in configuration supplies install/build/output values; do not override them with the
default root `pnpm build` or point output at the source directory.

Set these project environment values separately for Preview and Production:

| Variable | Value and purpose |
| --- | --- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, enabling the repository's pinned `pnpm@12.4.2` |
| `STACKLENS_API_ORIGIN` | Reachable HTTPS origin of the matching staging or production API, without `/v1` |
| `VITE_STACKLENS_API_BASE_URL` | Leave unset; the browser uses the same-origin rewrite |

For example, `https://api.example.com` describes the required shape, not a provisioned service.
There is no fallback origin. Missing configuration intentionally fails preparation rather than
publishing a frontend whose analysis forms cannot reach their backend.

Vercel evaluates programmatic configuration at build time. Changing the API origin therefore
requires a new deployment. Keep `STACKLENS_API_ORIGIN` outside Turbo's web build: it affects routing,
not bundled assets. It is not prefixed with `VITE_` and is not shipped as a client environment value.

Leave `DATABASE_URL` and `STACKLENS_GITHUB_TOKEN` in the API/Worker host's secret manager.
Never paste backend `.env` content into the Vercel project. Keep build/source visibility private
and preview protection enabled while staging validation is incomplete.

## Backend preparation required before a usable preview

The backend host must provide Node 24, the pinned pnpm version, two supervised long-running
processes, PostgreSQL, TLS and outbound access to the fixed GitHub/npm/OSV providers.
Build StackLens from the same reviewed revision with `pnpm install --frozen-lockfile` and
`pnpm build`. The compiled package exports and runtime dependency graph must be present.
Do not install or execute any repository submitted to StackLens for analysis.

Start the API with `pnpm --filter @stacklens/api start` and the Worker with
`pnpm --filter @stacklens/worker start`. Supply an explicit `DATABASE_URL` to both processes;
the checked-in fallback database credentials are local development defaults.
In a container, set `STACKLENS_API_HOST=0.0.0.0` and bind `STACKLENS_API_PORT` to the host's
configured service port. Keep PostgreSQL private. Set `STACKLENS_WORKER_CONCURRENCY` according
to measured resource limits, initially matching the existing value of two unless the host requires
less. An optional read-only `STACKLENS_GITHUB_TOKEN` belongs only to the Worker.
For the managed preview, use concurrency one and the verified CA/pool settings in the
[managed runbook](managed-hosting.md#postgresql-runtime-settings). No usable API origin exists yet.

Startup applies StackLens and Graphile migrations and begins the source-free delivery pump.
Provide orderly SIGTERM handling and enough shutdown time for both runtimes to stop.
Test migrations, process restart and queue recovery against staging before enabling production.
The host needs explicit resource/request limits and source-free logs with finite retention;
the provider adapters' existing bounds remain in force.

The [portable backend target](backend-hosting.md) provides container builds, PostgreSQL and Caddy TLS
routing. Retention now defaults to 24 hours from submission, configurable with
`STACKLENS_RETENTION_HOURS` from 1–8760 integer hours. The Worker performs bounded terminal-record
cleanup on startup and every sixty seconds after the previous sweep. Reports and delivery records
cascade; active/queued execution and legacy null-expiry data are preserved. Monitor stalled jobs and
cleanup backlog. Production backup/log storage still needs a compatible finite-retention policy.
See ADR-0015 and SEC-003 for the accepted boundary.

## Preview acceptance sequence

Use a preview from the reviewed branch with a staging backend. Record its URL, deployment ID,
Git revision, UTC time, API/Worker revisions, Node/pnpm versions and provider configuration presence
without recording secret values. Local configuration tests do not establish Vercel edge behavior.

1. Verify HTTPS, correct static JavaScript/CSS/font content types and direct navigation/refresh for
   `/`, `/quick` and an existing `/analyses/:analysisId`. Missing assets should return 404.
2. Read `/openapi.json` through the Vercel origin and confirm the three public REST routes.
3. Submit quick paste and upload through `/v1/analyze/manifest`. Check contract-valid reports,
   preserved input on an invalid manifest and absence of durable quick-analysis rows.
4. Submit KerjaLog and frey-ui through `/v1/analyses/repository`. Record the resolved commits;
   do not assume the September 30 HEADs remain current. Observe queued/progress/terminal state,
   report limitations, strict schema validation and stopped terminal polling.
5. Inspect repeated status responses: no stored CDN response or increasing `Age`, no stale progress,
   and no public response caching. Confirm `no-store` at the backend origin as well. Verify POST
   JSON bodies and API errors remain JSON through the rewrite; `/v1/not-a-route` must not become
   the SPA document.
6. Confirm an actual repository failure remains distinct from completed-with-limitations. Restart
   API/Worker during a staging job and verify durable recovery without overwritten terminal state.
7. Complete the [manual screen-reader/device guide](manual-release-validation.md). Record real
   results and browser/device versions separately from automated or emulated observations.
8. Exercise finite retention and backup restore against the prepared backend.
   Record the policy, deletion behavior and restore proof without exporting source or secrets.

Keep the September 30 [local evidence](mvp-release-readiness.md) as a separate historical pass.
It cannot substitute for these deployed checks. Run branch CI after publication and before launch.

## Rollout and rollback

Promote a verified preview only after staging acceptance, retention, backups and manual acceptance
are complete and production deployment is authorized. Set Production's API origin explicitly;
preview settings must not silently become production settings.

Keep the previous verified static deployment and its matching backend revision available for
rollback. Backend rollback must preserve both schema 1.0.0 and 2.0.0 report readers; do not rescore or
rewrite historical report JSON. Recheck same-origin routing and terminal polling after rollback.
Do not describe a build success or a linked project as a successful production release.

## Local verification and current evidence

Run `pnpm test:deployment` for origin guards, API-prefix preservation, known deep links and cache
directives. These tests also run at the beginning of `pnpm test`, including within `pnpm check`.
The web build command above can be rehearsed without cloud credentials. No Vercel SDK, application
dependency or analyzed-repository execution is introduced.

The [October 1 preparation record](release-evidence/2026-10-01-hosting.json) distinguishes local
checks from pending preview/production evidence. No linked project, hosting resources, paid service,
Git push or deployment was created by target preparation.
