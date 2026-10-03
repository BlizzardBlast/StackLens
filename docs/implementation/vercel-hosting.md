# Vercel web hosting target

> **Status:** Public static web and API proxy verified; release gates open\
> **Date:** 2026-10-02\
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

The portable API and Worker are ordinary Node 24 processes under ADR-0002/0004/0014. The optional
[Vercel API project](vercel-api-hosting.md) uses request-bound Fastify Functions under ADR-0016;
the Worker remains continuous. PostgreSQL must be shared by these runtimes. A managed database requires a direct
certificate-verified TLS connection; a self-hosted database can remain on the host's private network.
The web project has no database or provider credentials. The existing local `compose.yaml` continues
to own only development PostgreSQL.

## Free-plan fit

Checked on 2026-10-01: [Vercel Hobby](https://vercel.com/docs/plans/hobby) is free within its quotas
and restricted to personal, non-commercial use. It fits a personal preview of this static frontend.
Confirm plan eligibility before a commercial hosted launch.

Vercel also [supports Fastify APIs](https://vercel.com/docs/frameworks/backend/fastify) as Functions.
The separate [API target](vercel-api-hosting.md) now uses a request-bound runtime under ADR-0016,
with the API recovery timer disabled and PostgreSQL pool attached to Fluid Compute. The external
Silly Worker still owns execution/recovery; no queue or Workflow migration is introduced.

The user requires no payment card. The [managed setup](managed-hosting.md) records the live
Aiven Free database, continuous Silly Worker, rejected Northflank/Render card-required activation
and inactive Railway trial. Separate Hobby projects `stacklens-api` and
`stacklens` are now live. The web at
[stacklens-web.vercel.app](https://stacklens-web.vercel.app) proxies
[stacklens-api.vercel.app](https://stacklens-api.vercel.app). Both track the reviewed release branch
in Vercel's Production environment, with only Production builds enabled. This is a personal preview.
The approved Aiven values stay in API Production; no database/provider secret goes to the web.
Earlier API startup failures remain recorded. See [public acceptance](public-preview-validation.md)
for successful routes/reports/browser checks and remaining recovery/capacity/manual release gaps.

## Project names and domains

The web project is `stacklens` (`prj_RWR5i1zdAHfFdVBDh8IbNPJcBGC4`); the API project is
`stacklens-api` (`prj_Zd0NV89v672Ru0RntrsFNZ2b7O7s`). Renaming preserves these project IDs,
Git integrations and existing secret destinations. Deployment readiness is documented separately
from the project names.

Vercel rejected `stacklens.vercel.app` because another team already owns it. The web therefore uses
`https://stacklens-web.vercel.app` and `STACKLENS_API_ORIGIN=https://stacklens-api.vercel.app` in
Production. Changing this Config value requires a web rebuild. Keep the original
`project-j0e3o.vercel.app` and `project-q766o.vercel.app` aliases during the transition so shared
report links and existing rewrites continue working. The
[naming record](release-evidence/2026-10-02-project-naming.json) preserves the exact provider response
and the checks before routing was rebuilt. Earlier acceptance records retain their original URLs.

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

Set these values separately for each enabled environment. The current personal preview enables
Production only, tracks `codex/mvp-release-readiness`, and saves Config values there:

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
Never paste backend `.env` content into the static web project. The separately approved API project
may receive only its required database values. Keep build/source visibility private
and preview protection enabled while staging validation is incomplete.

## Backend preparation required before a usable preview

For the portable process alternative, the backend host must provide Node 24, the pinned pnpm
version, two supervised long-running processes, PostgreSQL, TLS and outbound access to the fixed
GitHub/npm/OSV providers. The activated Vercel API instead uses the separate Function runbook;
only its Worker remains a continuous process.
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
[managed runbook](managed-hosting.md#postgresql-runtime-settings). The verified API origin is
`https://stacklens-api.vercel.app`; the optional Function target needs only the continuous Worker.

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
Git push or deployment was created by that earlier preparation. The separate
[October 2 public record](public-preview-validation.md) supersedes its pending deployment state
and preserves the operational/manual release gaps.
