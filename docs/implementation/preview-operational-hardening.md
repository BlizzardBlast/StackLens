# Preview operational hardening

> **Date:** 2026-10-03\
> **Status:** Bounded lifecycle, constrained soak and separate-cluster recovery verified; hosted release gates remain\
> **Decision:** [ADR-0018](../adr/0018-preview-operational-recovery.md)\
> **Requirements:** FR-003/004/017/021/022, NFR-008/009, SEC-001/002/003/007, GOV-002/006/007

## Baseline and scope

The remote `main` ref and local checkout resolve to `33de1db44aa416f5d6cf4d39669eaef4feb7171d`,
the merged [PR #41](https://github.com/BlizzardBlast/StackLens/pull/41). Its old head
`8d0993356e4507678b111d4c45aafabd188186ea` has identical tracked files. Chrome inspection confirms
the current Ready Vercel web deployment `Gq4WZy2H43i3Uq3jpubw8HEgsU2y` and API deployment
`8aAjQ1Cee1E3Zn4FFMbHPsYQZajk` use that old head and still track `codex/mvp-release-readiness`.
No production-branch setting or public deployment was changed in this follow-up.

Development uses `codex/preview-operational-hardening` in the existing checkout. Captures distinguish
the base commit, changed runtime file hashes and measured hosted revisions. Local startup events
use the base SHA as an environment fixture; that field alone is not proof of a deployed revision.
The new initialization event is prepared locally and has not been observed on deployed Vercel.

The [dated evidence](release-evidence/2026-10-03-preview-hardening.json) contains safe counts, hashes,
timings, failure codes and scopes. Earlier failed captures remain separate. It contains no report
bodies, database credentials, keys, repository source or provider responses.

## Results

| Check | Verified result | Practical limit |
| --- | --- | --- |
| API process lifecycle | Three fresh Linux instances; 24 concurrent lookups; paused process resumes its request; zero API clients after idle | Docker process simulation does not prove Vercel suspension or autoscaling |
| Hosted API burst | Concurrency 1/2/4 plus idle/resume; aggregate peak seven clients; zero API clients after idle | Unknown platform cold state; sampled API peak is one, not proof of instance count |
| Worker soak | Eight serial live-provider jobs, alternating frey-ui/KerjaLog, all contract-valid limited reports; 249.68 MiB cgroup peak; zero memory-limit/OOM events; clean exit | Two immutable repository revisions at 256 MiB/0.25 CPU, concurrency one; little headroom |
| Actual preview backup | Encrypted consistent archive; 11 stored reports restored into a separate local PostgreSQL container; all seven table fingerprints match; strict readers pass | Local fallback depends on an unexpired archive, key and surviving workstation |
| Restored preview API | All 11 restored reports return terminal success through the existing API with the delivery pump disabled | Local readback only; no public routing cutover |
| Copied queue recovery | Separate PostgreSQL clusters; original executor killed and awaited; active/queued/outbox work completes; expired terminal fixture removed; four API readbacks pass | Synthetic providers and local API readback; public routing cutover is untested |
| Aggregate connection budget | Disposable non-superuser limit saturates independent pools, preserves admin access and recovers after release | Hosted shared-role limit 14 is prepared; Aiven rejects activation with SQLSTATE `42501` |

The first eight-job soak stopped after six recorded successful jobs. Its post-cleanup exit code is
137, with `OOMKilled: false`; the original interruption cause was not captured. Do not label that
attempt an OOM or a successful eight-job soak. Improved phase/subprocess diagnostics accompany the
successful repeat using the same Worker archive. The first API harness also incorrectly treated
a startup migration's transient idle transaction as leaked state; the corrected check requires no
idle transactions at final idle. Preserve both failures without weakening the final assertions.

Aiven's October 3 Chrome Backups page lists completed snapshots at October 3 07:58:06 UTC,
October 2 07:58:08 UTC and October 1 12:33:43 UTC, totalling 103 MB in `do-blr1`. The latest
observed snapshot meets the policy's 24-hour freshness target. Three listed snapshots do not define
the Free plan's guaranteed retention or prove provider-managed restoration.

## Repeat local measurements

Run `pnpm build` first. Use Docker and PostgreSQL 18, with a disposable loopback database whose
account can create databases/roles. `TEST_DATABASE_URL` must never point at the hosted service for
these commands. Select an explicitly built API image and prepared Worker archive:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens_operations'
pnpm test:operations
docker build --target api --tag stacklens-api:reviewed .
node scripts/operations/api-lifecycle.mjs stacklens-api:reviewed .cache/operations/api-lifecycle.json
# Build the Worker image and package it with the existing panel packaging procedure first.
node --env-file=.env scripts/operations/worker-soak.mjs .cache/operations/worker.tar.gz 8 .cache/operations/worker-soak.json
```

The soak uses the public-only token already configured for local development, never broader CLI
credentials. It runs StackLens's reviewed application in the panel's Node 24 Linux image with a
256 MiB/no-swap/0.25 CPU limit. It does not execute analyzed repository code. The count is bounded
to 2–12 and each analysis has a ten-minute observation deadline. It creates/removes its own
database, container and transient private environment file. Keep provider rate limits in mind when
choosing another capture; a live soak is outside CI.

For the synthetic restore/replay rehearsal, use two separate local PostgreSQL servers:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://stacklens:stacklens@127.0.0.1:55434/stacklens_recovery'
$env:RESTORE_DATABASE_URL = 'postgresql://stacklens:stacklens@127.0.0.1:55435/stacklens_recovery'
node scripts/operations/recovery-rehearsal.mjs .cache/operations/recovery-rehearsal.json
```

The script snapshots a completed historical report, an expired terminal record, a running claimed
job, a queued job and a pending outbox record. It proves actual child-process exit before exact-owner
recovery, restores on the other cluster, cleans expiry before API readback, and preserves source
claims and historical report JSON. The deferred outbox fixture's availability clock is advanced only
on the copied target. Both owned databases and temporary synthetic archive/key are removed.

## Hosted observation and connection budget

Create a private JSON file containing only `DATABASE_URL` and `STACKLENS_DATABASE_SSL_CA` at
`.cache/operations-private/database.json`. Restrict its filesystem permissions. Acquire these values
only from the approved operator/runtime destination and never print the file. Keep the static web
project free of database/provider credentials.

```powershell
node scripts/operations/hosted-connections.mjs .cache/operations-private/database.json 8d0993356e4507678b111d4c45aafabd188186ea .cache/operations/hosted-connections.json
node scripts/operations/connection-budget.mjs plan .cache/operations-private/database.json 14 .cache/operations/connection-budget-plan.json
```

The live observer includes its own one-client pool in aggregate counts. Requests address a fixed
nonexistent analysis ID and expect sanitized 404; they create no hosted jobs. Idle/resume alone
cannot establish that the platform suspended an instance.

The server has 20 maximum connections and three superuser-reserved slots. The shared non-superuser
role's setting remains unlimited (`-1`). An attempted `apply` of 14 failed with `42501`, with zero
sessions terminated. The inspected Aiven user menu exposes credential reset, not a connection-limit
control. Do not elevate credentials, grant broad administrative membership, or mark the guard active.
The tool's `apply` mode is available to an appropriately authorized operator after a fresh plan; it
requires three normal slots of headroom. Record and verify the previous setting for rollback.

[PostgreSQL role limits](https://www.postgresql.org/docs/current/sql-createrole.html) are approximate
and this proposed shared budget would not reserve Worker slots. A dedicated restricted API login
or connection broker requires migration/startup privilege and hosting review before activation.
Per-instance pool size and the finite hosted burst do not close aggregate overload acceptance.

## Retained archive and restore

The retained encrypted archive was captured at `2026-10-03T13:44:31.995Z` and expires at
`2026-10-04T13:44:31.995Z` (October 4, 20:44:31 Jakarta). Its filename is
`%USERPROFILE%\.stacklens\backups\preview-20261003.slbackup`; its dedicated key is in the separate
`%USERPROFILE%\.stacklens\keys\preview-20261003.key` directory with restricted Windows permissions.
Neither file belongs in Git, an upload artifact, browser screenshots or release evidence. These two
directories are on the same workstation; they do not provide recovery after workstation loss.

For a new archive, create a new dedicated key and filename. The `create` command uses verified TLS
and a consistent exported snapshot. Existing archive/key files cannot be overwritten:

```powershell
node scripts/operations/backup.mjs init-key C:/private/keys/new-preview.key
node scripts/operations/backup.mjs create .cache/operations-private/database.json C:/private/backups/new-preview.slbackup C:/private/keys/new-preview.key .cache/operations/backup.json
```

Restore into a local PostgreSQL 18 service using private configuration containing its
`DATABASE_URL`. The command authenticates and checks expiry before creating a new UUID-named owned
database, verifies its identity, imports both application/Graphile schemas, records fingerprints,
strictly reads reports and sweeps expired terminal records until the batch is exhausted:

```powershell
node scripts/operations/backup.mjs restore .cache/operations-private/local-target.json C:/private/backups/new-preview.slbackup C:/private/keys/new-preview.key .cache/operations/restore.json
```

The command retains that fresh database for review and leaves its queue stopped. Compare every
fingerprint with the archive creation record before reconfiguration. Never expose an unverified
target. For copied running jobs, follow [the exact-owner procedure](worker-recovery.md) only after
the original executor's actual exit. Start compatible readers before writers and preserve historical
schema 1.0.0/2.0.0 report JSON. After rehearsal, close target pools and drop only the generated owned
database named in the restore record; stop/remove only containers created for this rehearsal.

After an archive expires, authenticate its metadata and remove it with:

```powershell
node scripts/operations/backup.mjs expire C:/private/backups/new-preview.slbackup C:/private/keys/new-preview.key .cache/operations/expired-backup.json
```

Then remove its dedicated obsolete key. Expiry blocks restoration but does not automatically delete
files or erase data cryptographically. No recurring schedule is active. Refresh before expiry or
record that no usable fallback remains. Remove private client configuration when operator work ends.

## Remaining acceptance

October 4 final review added bounded streaming file reads for archives and keys, including early
oversize rejection and a regression with a sparse oversized archive. API lifecycle and recovery
cleanup attempt each owned resource independently and report failures. Both rehearsals pass again.
The user has authorized publication and deployment follow-through; consult the milestone PR and
resolve current remote `main` rather than assigning the October 3 captures to a later commit.

Current [Aiven Free-plan documentation](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
explicitly excludes connection pooling. A separate restricted API login therefore needs a tested
startup/migration path; changing pool size alone cannot close aggregate connection acceptance.

The final database-backed `pnpm check` passes compiled/native API/Worker smoke, strict workspace
and browser types, five deployment checks, five operator checks, all 18 Chromium/Firefox/WebKit
acceptance cases, lint and formatting. Its 22 Turbo test-graph tasks reuse the immediately preceding
successful uncached serial run (559 Vitest tests). The initial parallel run's existing database/UI
timeouts remain recorded; assertions, timeouts and package test configuration were not weakened.
Read-only self-review, documentation-impact and relative-link checks pass. Changes remain
uncommitted on the current branch; no new branch CI or deployment result is claimed.

Publish/review the prepared code through normal CI before deployment, and decide the Vercel
production branch promotion explicitly. Capture the new event on an actual deployed revision to
correlate runtime initialization; platform suspension and aggregate overload remain separate gates.
Resolve the restricted-login/broker path with supported provider privileges. Confirm Free backup
retention, automate agreed refresh/deletion, and rehearse replacement public API/Worker routing
before claiming disaster recovery readiness. Physical-device and spoken screen-reader acceptance
remain user-deferred. No paid service, card, privilege expansion or hosted queue replay occurred.
