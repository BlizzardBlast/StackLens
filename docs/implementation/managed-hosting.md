# Managed hosting setup

> **Status:** Public stack and Worker planned recovery verified; constrained capacity/manual gates remain\
> **Updated:** 2026-10-04\
> **Requirements:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-001/002/003/007, GOV-002/006/007\
> **Decision:** [ADR-0015](../adr/0015-vercel-static-web-target.md)

## Current resources and constraints

The user requires free hosting without supplying a payment card. The intended web target remains
Vercel Hobby for a personal preview. The database is Aiven PostgreSQL Free. Graphile Worker remains
continuous. The optional [Vercel API](vercel-api-hosting.md) is request-bound under ADR-0016;
durable delivery and provider execution stay on the Worker.

Current October 4 follow-through: PR #42/#43 are merged; both Vercel projects track main and are
independently Ready at `515576a`. The API uses Worker-managed initialization and a restricted
six-connection login. The owner Worker is unchanged. Both fresh requested repositories and
direct/proxied quick/polling checks pass, with final zero API clients. An encrypted eight-report
archive and active 12-hour backup heartbeat are maintained outside Git. Independent recovery
needs Neon Free sign-in in Chrome; no backup was transmitted. See the
[restricted API runbook](restricted-preview-api.md) for exact evidence, rollback and remaining gates.

The following resources were created through the user's authenticated dashboards; release-branch
references describe the October 2 capture, superseded by the October 4 main deployment above:

- Aiven project `stacklens-preview`, service `stacklens-preview-pg`, PostgreSQL 18.6, Free-1-1gb:
  one CPU, 1 GB RAM, 1 GB storage and a displayed 20-connection limit. The Free region selector
  chose Asia Pacific; the resulting service is DigitalOcean `blr`. No payment method was supplied.
- Northflank project `stacklens-preview` in US Central, with zero services. Its actual service
  creation form requires a card even for the Developer Sandbox. No service or payment method was
  created. This dashboard evidence supersedes the earlier blog-based no-card recommendation.
- Railway private project `stacklens-preview`, with `stacklens-api` and `stacklens-worker` services
  saved offline in the default `production` environment. That platform environment name does not
  constitute a production release. GitHub sign-in was completed by the user. Non-secret variables,
  Dockerfile builds and API startup health path `/openapi.json` are configured; no source, database
  credentials, provider token, public domain or deployment has been uploaded.
- Silly Development free Node server `stacklens-worker-preview` (`60761d98`), created after the
  user completed signup. Its installed runtime is set to Node 24 and main file `start-worker.js`;
  additional package/argument fields are empty. After explicit user approval, the reviewed Linux
  package and private Aiven runtime credentials were uploaded and the Worker activated.
  The actual creation form explicitly says no card is required for Free.
- Render account access after user-completed GitHub sign-in. After approved branch publication and
  private Aiven credential entry, the actual Free/$0 deployment opened card verification. No card
  was supplied. A fresh dashboard confirms no services or public origin. The
  [Render blueprint](render-hosting.md) passes schema validation; account eligibility is blocked.
- Vercel Hobby project `stacklens-api` in `freys-projects`, connected to
  `BlizzardBlast/StackLens` and tracking `codex/mvp-release-readiness`. Fastify, `apps/api` root,
  outside-root workspace files, Node 24, Fluid Compute and Singapore are saved. The three
  non-secret build/runtime values are saved for its Production environment. The provider's
  environment label does not establish a product release. After explicit new-destination approval,
  the two Aiven values are saved only in the API Production environment. Builds allow the reviewed
  release branch. Runtime `75bf5a2` fixes the native startup boundary: export Fastify's ready,
  unbound server and let Vercel bind it. The API is verified at
  [stacklens-api.vercel.app](https://stacklens-api.vercel.app), with a 60-second project duration.
- Separate Vercel Hobby web project `stacklens` at the repository root, using Vite,
  Node 24 and the checked-in programmatic configuration. It is verified at
  [stacklens-web.vercel.app](https://stacklens-web.vercel.app). Only Corepack and the public API
  origin are saved; no backend secrets are transferred. Both projects track the release branch
  and build only Production, the platform label used for this personal preview.

The [October 1 setup](release-evidence/2026-10-01-managed-hosting.json) and
[local container rehearsal](release-evidence/2026-10-01-hosting.json) remain historical evidence.
The [October 2 API record](release-evidence/2026-10-02-api-target.json) preserves failed attempts;
[public acceptance](public-preview-validation.md) records working API/web routes and both reports.
The active-job panel restart delayed KerjaLog completion to 4h 10m after submission; immediate
recovery is not proved. A panel memory sample reached 257.36 MiB against the 256 MiB display limit.
Capacity, prompt recovery, Function suspension, remote expiry/restore and real screen-reader/device
acceptance remain release gates. Drain before planned maintenance; never force-unlock a live Worker.

**Later October 2 follow-up:** The reviewed Worker patch, validated on a dirty base `405b420`, is active.
Planned Stop/offline/Start returned an active job to the queue without a partial report and the
same KerjaLog ID finished in 192,798 ms. The final constrained Linux run completed both repositories
with 244.25 MiB peak and no memory-limit/OOM events. Remote expiry cleanup and isolated backup/report
restore pass. Earlier measurements remain historical; sustained capacity, Function suspension/
aggregate connections, operational backup policy and manual phone/screen-reader acceptance remain
open. See [Worker recovery](worker-recovery.md) for the exact hashes, limits and operator procedure.

## Compute candidate

[Railway's pricing](https://railway.com/pricing) advertises a no-card trial with $5 for thirty days,
then $1 of monthly Free credit and up to one vCPU/0.5 GB RAM per service. This is a candidate for a
bounded preview. The actual dashboard displays thirty days/$5 remaining and trial limits of two
shared vCPU/1 GB RAM per service. Verify outbound networking before activating a trial deployment.
Do not upgrade, add a card, buy credits or claim guaranteed monthly uptime.

Local Linux startup measurements were 159.2 MiB for API and 167.8 MiB for Worker. These are brief
startup observations, not steady-state billing measurements. At Railway's advertised $10/GB/month
RAM rate, continuous usage at those levels would cost roughly $3/month before CPU or network.
The recurring $1 allowance is therefore not established as sufficient; Railway is retained only
as an inactive trial-preview option. The CLI is available through `npx @railway/cli@5.63.1`, but is
not authenticated. No repository installation or backend-secret transfer was performed.

ClawCloud advertises monthly credit for eligible GitHub accounts, but its site could not be resolved
from the actual browser during this session. It is not a verified deployment option. Current
Hugging Face documentation requires a paid plan for newly created Docker/Gradio compute Spaces.
Do not reuse older free-Docker-Space instructions.

If a bounded Railway trial is explicitly selected, use one API instance and one Worker instance with no paid
volumes or managed database add-ons. Keep Worker concurrency at one and measure actual usage.
Both services consume the same free account allowance. Reaching a credit limit can interrupt jobs;
PostgreSQL retains the durable queue, but it cannot run a stopped Worker.

The root Dockerfile preserves targets `api` and `worker`, and adds a final selector stage for
hosts without a build-target control. Set the non-secret `STACKLENS_RUNTIME=api` or `worker`
service variable: Railway passes declared Docker `ARG` values at build time. The default is Worker.
Local Linux builds verified both selected package identities and their non-root startup/health
against an isolated Aiven database. Existing Compose target builds remain supported.

Railway CLI `up` can upload this reviewed checkout without a Git push. `.railwayignore` excludes
environment files, caches, generated outputs, documentation and prototype code. Upload from the
repository root, explicitly selecting this project, environment and service. Do not use `--new`
or `--no-gitignore`. Keep database credentials in runtime variables; only the runtime selector is
declared as a Docker build argument. No analyzed repository may be built or installed. Account
authorization and database-secret transfer to a newly selected host remain activation steps.

[Silly Development](https://sillydev.co.uk/) advertises no-card, non-expiring background-worker
hosting with 0.25 CPU, 256 MB RAM and 512 MB disk. The user completed signup and the Free service
was created without a card. Node 24 is available and selected. A local constrained Worker
(256 MiB, no swap, 0.25 CPU, concurrency one) completed frey-ui
with explicit limitations. KerjaLog reached terminal failure; GitHub's anonymous allowance was
subsequently observed at zero. The failure payload and memory peak were not retained, so the cause
and complete resource fit remained unverified in that local experiment. The remote Worker now
passes startup and Aiven TLS/migrations. Its initial anonymous run completed frey-ui and failed
KerjaLog at GitHub's rate limit. An approved public-only token allowed both authenticated runs to
complete with limitations. Sampled memory peaked at 249.41 MiB of 256 MiB; this is not a cgroup
peak or proof of arbitrary workload capacity. It provides no managed HTTPS,
so the API would still need a separate HTTPS host. This is a community preview candidate, not a
verified release target or an uptime guarantee.

## Prepared Silly Worker package

The current archive includes root `recover.js` for the explicit confirmed-dead-owner command. Normal
startup remains `start-worker.js` with empty Additional Arguments. Because the panel routes ordinary
JavaScript through ts-node, the Linux launcher replaces that child with native Node before database
connections, using 96 MiB old space and omitting source-map loading. The ts-node parent remains.
Never select recovery during ordinary startup or unlock a live owner. See [ADR-0017](../adr/0017-worker-interruption-and-recovery.md).

The panel uses `ghcr.io/ptero-eggs/yolks:nodejs_24` and its startup command runs `npm install` when
a root `package.json` exists, then starts ordinary `.js` filenames through `ts-node --esm`.
Do not upload a Windows `pnpm deploy` tree or reinstall the bundled workspace graph on the host.
Prepare the Linux production runtime from the reviewed Worker image:

```bash
node scripts/prepare-silly-worker.mjs stacklens-worker:<reviewed-tag> .cache/stacklens-worker-silly.tar.gz
```

The script validates the image's package identity, preserves the already-installed production
dependencies, renames root package metadata to `worker.package.json`, removes only the packaged
root TypeScript configs and adds a `dist/package.json` ESM boundary. The repository's compiler
configuration is untouched. Removing packaged configs resolves the observed `TS5083` failure from
the panel's loader attempting to resolve the absent monorepo root. The archive contains no runtime
credentials and is approximately 16 MB compressed/88 MB unpacked for this revision.

The panel's built-in archive decompression converted pnpm dependency symlinks into ordinary files,
causing `ERR_MODULE_NOT_FOUND` for `@stacklens/persistence`. Upload the archive without using that
decompression action. Upload `deploy/silly/install.js` separately, temporarily set main file to
`install.js` and Additional Arguments to the reviewed archive's SHA-256, then start it once.
The installer validates that hash and runs Linux `tar`, preserving dependency links; it removes
the uploaded archive after successful extraction. Confirm its success and the links, restore main
file to `start-worker.js`, clear arguments and remove the one-shot installer before normal startup.
No repository under analysis is installed or executed. The panel limits main filenames to 16
characters; `install-worker.js` would be rejected.

`deploy/silly/start-worker.js` is copied to the archive root. It loads a separately supplied private
`runtime.env`, forces production mode, and imports the existing compiled Worker entrypoint. Startup
and shutdown remain owned by `apps/worker`; this adapter contains no analyzer or queue policy.
The runtime file supplies the database URL, actual multiline CA PEM, pool max five/concurrency one,
and an optional scoped public-GitHub provider token. Keep it outside Git and the public/source
archive. Never send these credentials to the Vercel client.

Local verification used the panel's Node 24.17.0 image (recorded digest in release evidence), an
isolated Aiven database, 256 MiB/no swap and 0.25 CPU. The adapted `ts-node` startup, verified TLS,
StackLens/Graphile migrations and continued running state passed. The cgroup memory peak reached
the full 256 MiB limit with reclaim pressure but no OOM kill; this proves bounded startup only,
not sufficient headroom for every repository. Temporary containers, databases and runtime files
were removed. The subsequent approved upload used a temporary API key, a separate `runtime.env`
with mode `0600`, and the exact recorded archive hash. The corrected native extraction and remote
startup passed; no npm reinstall or paid upgrade was used.

## Remote Worker acceptance

The local compiled Fastify runtime submitted public REST-contract requests to the shared Aiven
database; the Silly Worker alone executed the real provider jobs. This verifies remote compute and
the durable queue, but not a public API origin or Vercel. Both StackLens/Graphile schemas were
created by remote startup before the local API runtime was initialized. A PostgreSQL session
from the host's egress address was observed with TLS enabled.

### Initial anonymous run

| Repository | Remote outcome | Duration | Evidence limits |
| --- | --- | --- | --- |
| frey-ui | `completed_with_limitations`, schema 2.0.0 | 107.9 seconds | 48 limitations; GitHub blob rate limits, bounded npm response sizes and npm timeouts |
| KerjaLog | `failed`, `repository_unavailable` | 11.3 seconds | GitHub metadata rate limit; retry-after 2026-10-01T15:25:12Z |

The Worker remained running after both deliveries, with concurrency one and pool max five.
Anonymous quota is shared with the host's egress users; resetting a workstation's quota does not
restore the host's allowance. These historical outcomes remain in the evidence alongside the rerun.

### Authenticated rerun

After authorization and user-completed GitHub account verification, a new fine-grained token
`StackLens preview public GitHub` was created with public-repository read access only, zero account
permissions and zero private-repository permissions. Expiration is 2026-10-31. Authenticated core
quota was verified as 5,000 before installation. The token was added to the approved Worker's
private `runtime.env`, mode `0600`, existing settings preserved, and the Worker restarted.
Do not reuse broader GitHub CLI credentials. Renew the expiring token before continued previews;
no scheduler or automatic renewal has been configured.

| Repository | Immutable commit | Remote outcome | Duration | Evidence limits |
| --- | --- | --- | --- | --- |
| frey-ui | `6dbd184ace64d28c6a7ca7c2c75263215f4ac9bf` | `completed_with_limitations`, schema 2.0.0 | 158.1 seconds | 24 limitations; three `npm_response_too_large` failures at the existing 16 MiB response bound |
| KerjaLog | `9e5f869bbcf5b9d582f8e1453395ea2c06c79f83` | `completed_with_limitations`, schema 2.0.0 | 127.0 seconds | Five static configuration/check/source-usage limitations; zero provider failures |

Both deliveries finished with the remote Worker still running and Aiven TLS sessions verified.
GitHub provider failures are absent from these reports. Static limitations remain honest unknowns;
neither repository was built, tested or installed by analysis. Sampled memory reached 261,525,504
bytes (249.41 MiB), leaving little measured headroom below 256 MiB. Host polling reports samples,
not a cgroup peak or exhaustive OOM evidence. Intermediate progress stages were not captured by
this verification helper; its recorded queued/running/terminal statuses do not prove every stage.
Retain all provider failures and limitations; task completion is not full public-stack acceptance.

A second temporary Silly upload key was revoked after the authenticated jobs. Reuse returned
`401`, and the dashboard showed zero API keys. Local private copies and browser token bindings
were removed. The approved expiring GitHub token remains on the Worker alongside Aiven credentials.

A deliberate stop/start preserved both terminal API payloads byte-for-byte. The first immediate
start request did not bring the process back before the verification deadline; a later start
request succeeded, with remote TLS sessions re-established. Record that retry rather than claiming
an uninterrupted restart. This check does not cover active-job recovery. The temporary upload key
was revoked after validation: authenticated reuse returned `401` and the account dashboard showed
no remaining API keys. Local upload credentials were removed; approved runtime credentials remain
on the Worker host.

## PostgreSQL runtime settings

Both services use the same direct Aiven PostgreSQL endpoint. Graphile needs session semantics;
do not substitute transaction-mode connection pooling. The Aiven Free tier has no managed pooler.

| Variable | API | Worker |
| --- | --- | --- |
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | Aiven URL without SSL query parameters | Same database URL |
| `STACKLENS_DATABASE_SSL_CA` | Actual multiline Aiven project CA PEM | Same CA PEM |
| `STACKLENS_DATABASE_POOL_MAX` | `3` | `5` |
| `STACKLENS_API_HOST` | `0.0.0.0` | Unset |
| `STACKLENS_API_PORT` | `3000`, matching the public service port | Unset |
| `STACKLENS_RETENTION_HOURS` | `24` | Unset |
| `STACKLENS_WORKER_CONCURRENCY` | Unset | `1` |
| `STACKLENS_GITHUB_TOKEN` | Unset | Optional read-only public-provider secret |

The shared persistence pool validates positive integer limits and CA PEM, always verifies the
server certificate and hostname, and rejects URL `ssl*` parameters that could override the explicit
CA configuration. Remove Aiven's default `?sslmode=require` before supplying `DATABASE_URL` with
the explicit CA. Never use `rejectUnauthorized: false`. Runtime connection acquisition has a
ten-second timeout; the container health check uses a five-second connection timeout and a separate
one-connection pool with the same verified CA. The API/Worker runtime options are injectable;
unset hosted options preserve the existing local ten-connection pool default.

Three API plus five Worker connections leave headroom below the displayed twenty-connection limit.
Include health checks, migrations, administrator sessions and rollout overlap in that budget; the
displayed maximum is not a promise that all connections are available to application clients.
Avoid unmeasured replica scaling. Database passwords and provider tokens belong only in backend
runtime secrets, never Docker build arguments, repository files, the static web project or `VITE_*` values.

The Aiven endpoint is public with credential authentication and certificate-verified TLS. Its
initial allowlist is open to all; restrict it when stable backend egress addresses are available.
Free inactive databases can be powered off. Confirm operational backup retention and restore
capability before release; a provider's backup label does not prove this application's restore.

## Verification and activation

Live verification used a newly created isolated Aiven database, not the preview database's saved
reports. Verified TLS, rejection of an unrelated CA, StackLens/Graphile migrations, synchronous
quick analysis, durable repository submission, and provider-free Worker startup/shutdown. The
isolated database was removed after shutdown. This did not exercise real provider jobs on a remote
Worker, remote backup restore, retained-report expiry, public HTTPS routing or Vercel edge behavior.

The rebuilt Linux images also passed shared CA-backed health, package-identity, non-root and
read-only checks against another isolated Aiven database. That database and both containers were
removed after orderly shutdown. The separate constrained Worker experiment above is partial
evidence and does not replace full deployed acceptance.

The release branch was initially published at `7ce34f0` in draft PR #41 and CI passed. Render's
approved deployment hit card verification and created no service. The separately approved Vercel
API/web targets are now verified, with backend credentials only at the approved API destination.
During recovery capture their Git revision was `405b420`; the Worker follow-up has separate
dirty-source hashes. The follow-up is published through draft PR #41 under the existing branch
approval; resolve its current HEAD and both deployment revisions when reviewing.

1. Review the published Worker changes in PR #41 and retain the capture's exact source hashes.
   Keep the PR draft until its release gates close; no merge is authorized.
2. Recheck actual deployment revisions, Worker hashes and both public HTTPS origins after any
   publication. Keep the root/Vite web configuration, Production `STACKLENS_API_ORIGIN` and
   `ENABLE_EXPERIMENTAL_COREPACK=1`; backend secrets stay out of the web.
3. Preserve the [Worker evidence](worker-recovery.md), including provider limits, planned recovery,
   constrained memory, remote expiry and isolated restore. Measure sustained capacity, Function
   suspension and aggregate database connections before broader release approval.
4. Establish an operational backup policy. The successful private restore rehearsal does not
   establish scheduled backup retention, recovery objectives or disaster queue replay.
5. Complete [real screen-reader/device validation](manual-release-validation.md), currently left
   open at the user's request, and another browser engine. A working preview does not complete
   those acceptance gates.

Sources checked on 2026-10-01: [Aiven Node connections](https://aiven.io/docs/products/postgresql/howto/connect-node),
[node-postgres SSL behavior](https://node-postgres.com/features/ssl),
[Aiven Free tier](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier),
[Railway pricing](https://railway.com/pricing),
[Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles),
[Railway CLI deployment](https://docs.railway.com/cli/deploying),
[Silly Development terms](https://sillydev.co.uk/terms),
[Render Free](https://render.com/docs/free),
[Render Docker](https://render.com/docs/docker),
[Hugging Face Spaces](https://huggingface.co/docs/hub/spaces-overview).
