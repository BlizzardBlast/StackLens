# Portable backend hosting

> **Status:** Portable target rehearsed locally; managed preview tracked separately\
> **Date:** 2026-10-01\
> **Requirements:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-001/002/003/007, GOV-002/006/007\
> **Decision:** [ADR-0015](../adr/0015-vercel-static-web-target.md)

## Target and prerequisites

The user selected Vercel for the web and requested a new backend target. The backend is a portable
Linux Docker Compose deployment: Caddy terminates HTTPS, Fastify accepts requests, Graphile Worker
executes analysis, and PostgreSQL owns durable state. Any suitable container host can supply this
topology. No external host implementing this Compose topology, API DNS record or Caddy certificate
has been provisioned. The separate [managed preview](managed-hosting.md) uses the activated Aiven
database and Silly Worker. The [Render Free API](render-hosting.md) attempt hit card verification;
an optional [Vercel API](vercel-api-hosting.md) now preserves the same contract with request-bound
lifecycle under ADR-0016. Neither public API target has been deployed.

The host needs Docker/Compose, persistent storage, a public API hostname with DNS directed to it,
ports 80/443 for certificate issuance and HTTPS, and outbound access to the existing fixed provider
hosts. Keep PostgreSQL inaccessible from the public network. Start with capacity for the explicit
container limits and measure real jobs before tuning concurrency or memory.

## Free-tier candidate

The current no-card constraint excludes Oracle and Northflank service creation. The
[managed setup](managed-hosting.md) records the created Aiven Free database, verified TLS and
pool limits, activated Silly Worker, actual Northflank card blocker and inactive credit-limited
Railway candidate. Render API preparation is recorded separately. The
portable Compose target below remains a self-hosting option rather than the selected cloud setup.

The user asked about free hosting on 2026-10-01. Oracle Cloud Always Free is a candidate for the
existing container topology: run the API, Worker, PostgreSQL and Caddy on an Ampere A1 Linux VM.
This uses self-managed PostgreSQL, not Oracle's managed database product. At that comparison,
provider selection, account access, regional capacity and the API hostname were unresolved;
no Oracle resource was provisioned.

The [current Oracle resource documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
lists 1,500 OCPU-hours and 9,000 GB-hours per month, equivalent to **2 OCPUs and 12 GB RAM**, plus
200 GB total boot/block storage. Check the actual tenancy allocation and stay within all free
resource limits. Do not use older 4-OCPU/24-GB guides as the current free-tenancy allowance.
Free capacity can be unavailable, and idle instances can be reclaimed. The
[signup FAQ](https://www.oracle.com/cloud/free/faq/) requires an eligible payment card for identity
verification and describes temporary authorization holds. VM maintenance and backups remain
operator responsibilities.

Ampere A1 uses ARM64. The recorded local Linux image rehearsal does not verify ARM64 execution.
Build the application images for the actual host and repeat runtime, persistence, restart and
restore checks before using that host as release evidence. Vercel Hobby can serve the frontend
for a personal, non-commercial preview within its limits; see the [web runbook](vercel-hosting.md).

## Files and boundaries

`Dockerfile` builds StackLens with Node 24 and pnpm 12.4.2, then uses `pnpm deploy --prod` to produce
separate API and Worker runtime trees. The final images contain portable production dependency
graphs, run as `node`, and start compiled entrypoints directly. Repository analysis never installs
or executes the analyzed projects. `.dockerignore` excludes local secrets, caches and generated
outputs while retaining canonical design tokens and workspace source.

`deploy/compose.production.yaml` creates API, Worker, PostgreSQL 18 and the optional `https` gateway
profile. Node/PostgreSQL/Caddy images are pinned by digest. Keep those pins reviewed and updated as
part of maintenance. API/Worker use read-only filesystems with writable temporary directories,
dropped capabilities, an init process and a ninety-second graceful-stop budget. Default resource
caps are API 512 MiB/one CPU, Worker 1 GiB/one CPU, database 512 MiB/one CPU and gateway 128 MiB/half
a CPU. These are starting operational limits, not guarantees for arbitrary workloads.

The API check verifies database reachability and the OpenAPI listener. The Worker check verifies
database reachability while Docker tracks the main process. Neither establishes that a particular
analysis finished or that provider access works; inspect durable job state and run acceptance.
Unhealthy status is observable but Docker Compose does not automatically restart a running unhealthy
container. The host supervisor/monitoring must handle sustained unhealthy states.

`deploy/compose.rehearsal.yaml` adds loopback-only ports 3300 (API) and 55433 (PostgreSQL) for local
verification. It must not be used as a public production exposure. The repository's existing root
`compose.yaml` remains the development PostgreSQL definition.

## Prepare the host

Use the reviewed Git revision and give its immutable image tag to `STACKLENS_IMAGE_TAG`.
On the intended host, copy `deploy/.env.example` to `deploy/.env`, restrict its permissions and fill
the empty required values:

| Variable | Purpose |
| --- | --- |
| `STACKLENS_IMAGE_TAG` | Reviewed revision/image identifier; no mutable `latest` application tag |
| `STACKLENS_API_DOMAIN` | API hostname only, without scheme/path; its HTTPS origin is Vercel's `STACKLENS_API_ORIGIN` |
| `STACKLENS_POSTGRES_PASSWORD` | Unique database password from the host's secret management |
| `STACKLENS_DATABASE_URL` | `postgresql://stacklens:<URI-encoded-password>@postgres:5432/stacklens` |
| `STACKLENS_RETENTION_HOURS` | Initial value `24`; integer range 1–8760 |
| `STACKLENS_WORKER_CONCURRENCY` | Initial value `2`; tune from measured workloads |
| `STACKLENS_GITHUB_TOKEN` | Optional existing read-only public GitHub provider credential, passed only to Worker |

Optional `STACKLENS_API_MEMORY_LIMIT` and `STACKLENS_WORKER_MEMORY_LIMIT` override their caps.
Keep staging credentials, volumes, hostnames and Vercel environment separate from production.
Compose fails on empty required settings. `docker compose config` can print expanded secrets;
use `config --quiet` for validation and never attach expanded configuration or container environment
to release evidence. API/Worker production entrypoints refuse an absent `DATABASE_URL`.

When host activation is authorized, run from the repository root:

```sh
docker compose --project-name stacklens-production --env-file deploy/.env \
  -f deploy/compose.production.yaml --profile https config --quiet
docker compose --project-name stacklens-production --env-file deploy/.env \
  -f deploy/compose.production.yaml --profile https build
docker compose --project-name stacklens-production --env-file deploy/.env \
  -f deploy/compose.production.yaml --profile https up -d --wait
```

Startup applies StackLens/Graphile migrations and starts the transactional delivery pumps. Caddy
uses the configured API hostname and stores certificate state in persistent volumes. Verify DNS,
certificate issuance, renewal and the real HTTPS API before giving its origin to Vercel. No such
public origin exists merely because these files validate.

## Retention and operational data

Every API runtime submission receives an expiry 24 hours after creation unless configured otherwise.
Quick analysis does not create durable state. Origin and Vercel API responses prohibit browser/CDN
caching. On startup and every sixty seconds after its previous query, each Worker deletes at most
100 expired terminal analyses. PostgreSQL cascades report and delivery rows atomically.

Cleanup uses row locks and `SKIP LOCKED`; parallel Workers can sweep safely. It excludes queued and
running status and active job claims, and never edits Graphile internal tables. An expired running
analysis waits until terminal state, then the next sweep removes it. Monitor stalled jobs, sweep
errors and backlog; lifetime plus sweep scheduling/backlog is the actual deletion window.
Terminal delivery tombstones are removed only with their analysis. Legacy null-expiry records are
preserved, so an existing host needs a separate approved migration policy before claiming complete
retention coverage. Do not promise history beyond the configured lifetime.

Keep operational logs source-free and assign finite log retention on the host. Rotate/encrypt
backups and use a compatible expiry policy. The Compose template provides durable volumes and
bounded container logging, but does not configure off-host encryption, a remote backup schedule,
host alerts or a log-retention service. Those remain operator activation requirements.

## Backup and restore verification

Use PostgreSQL tools from the same pinned image. On a Linux host, a protected temporary dump can be
created without logging rows or credentials:

```sh
umask 077
mkdir -p backups
docker compose --project-name stacklens-production --env-file deploy/.env \
  -f deploy/compose.production.yaml exec -T postgres \
  pg_dump -U stacklens -d stacklens --format=custom > backups/stacklens.dump
```

Encrypt and transfer the dump using the host's chosen backup system, then remove the temporary
unencrypted file. Set finite backup expiry and periodically restore into an isolated database.
Restore with `pg_restore --exit-on-error`, compare source-free analysis/report/delivery counts,
then verify API polling and Worker recovery. Resume expiry cleanup immediately on a restored host.
Never overwrite the live database merely to test a restore. Protect persistent PostgreSQL and
Caddy volumes during upgrades; do not run production `down --volumes`.

## Rehearsal and release evidence

Use a distinct project name and private test values, then add the rehearsal override instead of
the `https` profile. This provides HTTP only on loopback. Validate Caddy independently with
`caddy validate`; that check does not issue a real certificate or verify Vercel edge routing.

The [dated preparation evidence](release-evidence/2026-10-01-hosting.json) records actual image IDs,
container health, contract checks, retention regression, restart recovery and backup/restore results.
Raw provider bodies, manifests, database credentials and operator tokens must not enter the record.
The [Vercel runbook](vercel-hosting.md) defines the subsequent public preview acceptance.
Complete the [manual acceptance guide](manual-release-validation.md) before claiming a release.
