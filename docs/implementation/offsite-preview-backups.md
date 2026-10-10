# Scheduled offsite preview backups

**Updated:** October 10, 2026. **Status:** approved custody activated; scheduled acceptance and
Codex scheduler handover pending. **Traceability:** NFR-010/009, SEC-003/007, FR-003/017/022; ADR-0022.

## Scope and boundaries

The existing Codex heartbeat captures and verifies a backup every twelve hours on the workstation.
The new `.github/workflows/offsite-preview-backups.yml` runs the replacement using GitHub-hosted
runners. It is disabled unless repository variable `STACKLENS_OFFSITE_BACKUPS_ENABLED` equals
`true`, and all secret-bearing jobs are restricted to `BlizzardBlast/StackLens` on `main`.
No PR event can reach live credentials. The existing `preview-recovery` workflow/environment keeps
its manual approval and original-compute fencing rules.

Online capture uses the existing read-only repeatable-read snapshot and bounded PostgreSQL custom
dump. It never pauses the API or stops the original Worker. The snapshot may contain queued/running
analyses and locked Graphile rows. `online.slmetadata` binds purpose `online-backup`, scope,
repository/run/commit, archive digest and seven fingerprints. It has no offline executor receipt,
cannot be used as the portable recovery manifest, and grants no authority to unlock a claim.
Only `database.slbackup` and `online.slmetadata` are uploaded as database data.

The capture environment receives the paired verified-TLS source configuration and dedicated random
32-byte master key. The readback environment receives only the master. HKDF-SHA256 derives a
distinct AES key for each scope/repository/run/commit, and a separate HMAC key authenticates artifact
retention labels. AES-256-GCM nonces remain random. Plaintext keys, logins, dumps, analysis IDs and
report bodies never enter artifacts or public evidence. Root rotation requires preserving the key for every
still-eligible archive and a documented mapping; deleting ciphertext is not cryptographic erasure
while its master survives. Keep a separately protected recovery copy of the master outside this PC.

## Capture, verification and maintenance

Capture runs at `05:17` and `17:17` UTC (`12:17` and `00:17` WIB), requesting two-day ciphertext
artifact retention. Each envelope still has an authenticated maximum 24-hour restore window. The
additional provider day gives hourly maintenance time to delete authenticated expired ciphertext
and confirm absence before provider expiration. Source-free receipts and synthetic fixture artifacts
request one day. Verification
runs on a fresh runner with only the named ciphertext artifact and master. Before target I/O it
authenticates both envelopes, their equal deadlines, identity and digest. The restore rechecks the
archive digest before creating a UUID-owned loopback PostgreSQL 18 database.

Verification compares all seven pre-purge fingerprints, strictly reads archived reports, removes
naturally expired terminal records, and reads remaining strict reports through worker-managed API
composition. It checks the missing-analysis 404/no-store contract and unchanged post-purge rows.
Both archived and retained report counts are recorded: zero retained reads explicitly sets
`populatedReportReadbackCovered: false`. No Worker, outbox pump, copied-claim unlock, public route
or private connection publication is started. API/pools, owned target and temporary private files
are removed on success and failure; cleanup failure prevents success.

Both live and synthetic capture/readback jobs prepare the PostgreSQL client image with at most
three attempts, each limited to sixty seconds, with ten- and twenty-second delays between attempts.
The helper suppresses raw Docker output and records only attempt number and success/failure/timeout.
Image preparation creates no database or private source files. It does not retry source capture or
restoration, and exhausted retries keep the job failed.

A failed startup receipt is initialized before checkout. After checkout, a dependency-free finalizer
records allowlisted setup step outcomes and image attempts, preserving the operation's actual report
coverage and cleanup receipt. Skipped operations are explicitly not started; cancelled operations
have unknown start state. Missing operation evidence cannot become success or establish cleanup.
The always-run artifact step uploads this source-free receipt after setup failure.
Operation receipts have a separate four-MiB read bound to preserve larger retained-report digest
lists; image diagnostics are bounded to sixty-four KiB. Missing, malformed or excessive operation
receipts fail as unreadable without claiming cleanup. Runner loss,
job timeout, or service-image failure before steps begin can still prevent receipt publication;
inspect the failed job itself and preserve the previous verified backup in those cases.

Hourly maintenance runs at minute 47. It scans at most 1,000 artifacts with bounded, timeout-limited
requests to fixed `api.github.com` endpoints; redirects are rejected. It authenticates each managed
retention label and binds it to the owning run's same repository, `main` SHA, scheduled/manual event
and exact backup workflow path. Only authenticated expired artifacts from that workflow are deleted,
with a confirming not-found check. Other artifacts and unauthenticated labels are preserved.
Capture/readback jobs have no `actions: write`; maintenance alone receives artifact deletion rights.

A fresh capture alone is insufficient: the owning `verify offsite backup` job must have succeeded
after upload and the artifact must still exist within its authenticated eligibility window. The
latest verified capture must be at most eighteen hours old. Missing/stale state, incomplete listings,
failed verification, API failures and unconfirmed deletion fail the Actions run and produce sanitized
evidence. Enable GitHub Actions failure notifications for the desired account recipient; this code
sends no email or external message itself. An hourly GitHub detector cannot diagnose total GitHub
schedule loss independently. Schedules may be delayed/dropped and public-repository inactivity can
disable them after sixty days. Monitor this separately when claiming continuous service.

Provider references: [scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments),
[artifact retention](https://docs.github.com/en/actions/tutorials/store-and-share-data).
Provider physical deletion timing and an exact backup freshness SLA remain unestablished.

## Local and cloud fixtures

After `pnpm build`, prepare `postgres:18-alpine` and set a loopback `TEST_DATABASE_URL` for
`pnpm test:operations`. The focused `offsite-backup.test.mjs` cases verify bundle tampering, wrong
identity/scope/key/purpose/expiry, protected inputs, artifact ownership, confirmed deletion,
stale/failed readback, bounded GitHub responses and real PostgreSQL quarantine/cleanup.
The fixture source runs real compiled API/Worker with synthetic providers, captures with those
runtimes still active, retains/expunges reports and includes a clearly synthetic locked queue row.
It never claims the synthetic owner is an actual dead executor.

`.github/workflows/offsite-backup-fixture.yml` captures and verifies on separate fresh runners with
a public fixture key and synthetic data only. The capture removes its owned source before handoff.
The restore does not receive the source login and never starts its queue. Ordinary quality tests
also cover real local restoration, mismatched-copy rollback and zero retained-report coverage.
Fixture CI and local tests do not establish scheduled live capture or secret-custody activation.

Local preparation in [PR #53](https://github.com/BlizzardBlast/StackLens/pull/53) passes the full
database-backed `pnpm check`, including compiled runtime smoke, eight new focused cases and eighteen
browser cases. Both workflows pass `actionlint` v1.7.12; shellcheck/pyflakes are not installed for
that validation. The focused PostgreSQL gate also passes separately. Both owned gate databases and
temporary private files are removed, and the temporary local PostgreSQL service is stopped while
preserving the development volume. See the
[source-hashed preparation evidence](release-evidence/2026-10-09-offsite-backup-preparation.json).
Resolve the exact PR head and cloud quality/fixture results before publication or activation.

Implementation head `1d098ca` passes quality run `37861337919`, portable recovery `37861337909`
and offsite fixture `37861337974`. The independent restore receipt records seven matching tables,
two archived strict reads, one retained strict/API read, one copied queue row left locked and
complete owned cleanup. Subsequent self-review corrects whole-second GitHub upload timestamps
against millisecond capture time; all eight focused checks pass again with deterministic regression
coverage. Verify the final documentation/correction head independently before merging.

The October 9 read-only verified-TLS source-scope review finds that the existing private source
login owns the backup tables and can create roles/databases. A read-only snapshot transaction does
not reduce that credential's authority. Review this concrete scope before unattended custody;
prefer a dedicated restricted backup login, and never transfer the current privileged source
configuration by assuming that manual recovery approval covers unattended access.

## October 9 approved activation

PR #53 merges as `4917f53e2e0ef350dbf3b8c10653281130e987eb` after final-head quality
`37861858309`, portable recovery `37861858405` and offsite fixture `37861858361` pass.
The operator approves unattended custody in new main-only `preview-offsite-capture` and
`preview-offsite-readback` environments. Capture holds a new restricted Aiven login plus a dedicated
32-byte master; readback holds only that master. A separate recovery copy is saved as
`STACKLENS_OFFSITE_BACKUP_MASTER` in the existing protected `preview-recovery` environment without
changing its protections. Local custody files have user-only Windows ACLs. The enable variable is true.

The new login has SELECT on public/Graphile tables and sequences, schema usage, database CONNECT
and a two-connection limit. It owns no relations, has no memberships or persistent write privileges,
and cannot create databases/roles or replicate. Read-only transactions are the default. The first
[live run](https://github.com/BlizzardBlast/StackLens/actions/runs/37924348193) fails capture because
Graphile's private tables enable RLS without reader policies; maintenance correctly fails freshness.
The corrected scope adds BYPASSRLS for complete logical backups, without changing PUBLIC grants,
source rows or queue policies. An exported owner snapshot and restricted reader match all seven
fingerprints, including the private task row. With read-only mode explicitly off, both public and
Graphile write attempts remain denied (`42501`). Recheck scope when schemas or privileges change.

[Live run 37926817042](https://github.com/BlizzardBlast/StackLens/actions/runs/37926817042) then passes
capture, fresh-runner restore and maintenance. Seven fingerprints match, missing-analysis API
readback passes, the copied queue stays stopped, and owned target/private files are removed. The
snapshot contains zero reports and explicitly records no populated readback coverage; this run
does not establish real report restoration. Its authenticated deadline is October 10 at
11:57:25 UTC (18:57:25 WIB). Maintenance preserves unrelated artifacts and removes zero expired
artifacts, so real expired-artifact deletion is still pending.

An ordinary frey-ui analysis completes on the existing Worker with schema 2.0.0, 24 limitations
and three bounded `npm_response_too_large` partial failures. A second
[live run 37927662152](https://github.com/BlizzardBlast/StackLens/actions/runs/37927662152) backs up
that report and passes seven-table restoration, one archived strict read, one retained strict/API
read, unchanged historical rows and complete owned cleanup. The latest authenticated deadline is
October 10 at 12:05:27 UTC (19:05:27 WIB). The first empty capture remains recorded separately;
the populated run closes its report-coverage limit. Neither run establishes scheduled acceptance
or actual expired-artifact deletion.

Scheduled capture/restore, an applicable reported PC-off interval and authenticated expired-artifact
cleanup remain handover gates. Keep `stacklens-encrypted-preview-backups` active. The scheduled
capture times are 00:17/12:17 WIB; scheduling may be delayed. The operator prefers a midnight
PC-off check, so the activation follow-through moves both the cron and its capture guard from
the original 08:17/20:17 WIB pair, preserving the twelve-hour cadence. A proposed October 10
00:05–01:00 WIB interval remains unverified until the actual interval is reported. See the
[activation evidence](release-evidence/2026-10-09-offsite-backup-activation.json) for receipts and limits.
A temporary hourly `stacklens-offsite-handover` follow-up checks these gates and stays quiet while
state is unchanged. It creates no backups. After acceptance, pause the old scheduler for rollback;
after the next successful cloud backup, delete its configuration while preserving results and
retire the temporary follow-up.

Activation and schedule head `7eb427e` passes quality `37928806261`, portable recovery
`37928806273` and offsite fixture `37928806291`. The read-only self-review confirms the matching
cron/guard, restricted custody, quarantine, source-free receipts and explicit handover gates; no
independent review is implied. Resolve the final documentation head and checks from
[PR #54](https://github.com/BlizzardBlast/StackLens/pull/54) before publication, and current main
independently in the next session. No future squash SHA is needed to finish this handover.

## October 10 startup failure and manual recovery

The published midnight schedule is present on main `08c0e54696b73c858cf52a9f0564e2bef242c2d9`.
[Scheduled run 37994848889](https://github.com/BlizzardBlast/StackLens/actions/runs/37994848889)
starts at October 10 04:40:25 WIB, after the intended 00:17 capture. It fails while pulling the
PostgreSQL client image with a network timeout, before source capture starts. Verification is
skipped. Its capture-evidence upload also fails because no receipt exists yet. Maintenance remains
healthy using the previous verified archive; maintenance-only schedule events with skipped
capture/readback do not satisfy scheduled acceptance.

[Manual recovery run 38005927489](https://github.com/BlizzardBlast/StackLens/actions/runs/38005927489)
then passes capture, independent seven-table restore, one archived/retained strict report and one
API readback, with unchanged historical rows and complete owned cleanup. It captures at October 10
06:46:03.942 WIB; the authenticated restore window ends October 11 06:46:03.942 WIB. These are
historical observations: verify artifact presence, key custody and the latest deadline before use.
This manual run does not establish scheduler-fired capture or PC-off acceptance. Maintenance removes
zero expired artifacts, so authenticated deletion plus confirming absence remains pending.

The startup correction adds the bounded image preparation and early/finalized receipts described
above to both live and public fixture workflows. The eight focused startup cases cover transient
recovery, exhausted retries, real hung-process termination, unavailable Docker, setup/download
failure, preserving restore/failure receipts, cancellation/missing evidence and nonzero CLI failure.
The [dated source-free record](release-evidence/2026-10-10-offsite-backup-startup.json) keeps the
failed scheduled attempt and successful manual recovery separate. Requirements, custody, capture
cadence and quarantine policy stay unchanged.

The correction also raises new live ciphertext artifacts' provider retention from one to two days.
With one day, provider expiration could remove an archive before hourly maintenance observed it
past its authenticated deadline, leaving no application-deletion proof. This extra storage margin
does not extend authenticated restore eligibility or change key custody. The existing deletion
policy still removes only expired, authenticated, workflow-owned artifacts and confirms absence;
unexpired archives are preserved. Older one-day artifacts retain their original provider policy.
Provider expiration alone still does not establish the handover deletion gate.

The database-backed `pnpm check` passes with `TURBO_CONCURRENCY=2`, including all forty-nine
operational cases, compiled API/Worker smoke and eighteen Chromium/Firefox/WebKit desktop/narrow
browser cases. The initial default-concurrency run hits timeouts in unchanged persistence tests;
that failed attempt and owned database cleanup remain in the dated record. No production/test
timeouts or shared test configuration are weakened. The reduced local concurrency uses the
[documented system variable](https://turborepo.dev/docs/reference/system-environment-variables).
Both workflows pass `actionlint` v1.7.12, excluding unavailable shellcheck/pyflakes.
Self-review separates the small image-diagnostic bound from the larger operation-receipt bound;
the same eight startup cases pass again, preserving a digest list exceeding sixty-four KiB.
Fresh final-head cloud quality and independent fixtures remain publication gates; resolve them from
[PR #55](https://github.com/BlizzardBlast/StackLens/pull/55) and resolve current main independently.

The proposed October 10 00:05–01:00 WIB PC-off interval has no actual operator report. Even if that
interval is later confirmed, the delayed failed capture falls outside it. Obtain an applicable
actual interval around a successful scheduled run; never infer PC-off from absent local activity.
Keep both backup and handover automations active until every acceptance gate passes.

## Concrete activation and Codex scheduler handover

1. Review and merge [PR #53](https://github.com/BlizzardBlast/StackLens/pull/53) from
   `codex/offsite-preview-backups`. Resolve the current main
   SHA, exact-head quality and two-job offsite fixture CI before live use. Do not enable the variable
   on a branch or change the old recovery environment's required reviewers.
2. Obtain approval for unattended access in two new environments restricted to `main`, without a
   per-run human reviewer: `preview-offsite-capture` and `preview-offsite-readback`. Capture holds
   `STACKLENS_BACKUP_DATABASE` (the dedicated restricted login's paired verified-TLS configuration) and
   `STACKLENS_BACKUP_MASTER` (a new random 64-character hex secret). Readback holds only that same
   master. Preserve a protected operator recovery copy outside this workstation; never place it
   in an artifact or PR. This is a new unattended custody policy, not an inferred extension of the
   existing manual recovery approval. Review the source login's existing scope before approval.
3. Set `STACKLENS_OFFSITE_BACKUPS_ENABLED=true` only after environments and secrets are configured.
   Dispatch `operation=backup`, inspect capture/verification/maintenance evidence, check seven
   matching tables, report coverage, quarantined copied claims and complete owned cleanup. Verify
   failures are visible to the intended operator. Exercise an expired fixture label before any
   live deletion claim. Keep unexpired ciphertexts and the master intact.
4. Observe a scheduler-fired cloud backup and independent restore with no workstation files or
   local Docker dependency; explicitly record an applicable PC-off acceptance interval. Verify
   authenticated expired-artifact cleanup on a later eligible run. Confirm current backup deadline.
   Only then retire Codex automation `stacklens-encrypted-preview-backups` through the app tool,
   preserving history. Pause it first if a rollback window is needed; delete it after stable handover.
5. Sweep any remaining old local archives under their original authenticated expiry policy while
   preserving unknown/unexpired archives and keys still referenced. Retiring the scheduler does
   not authorize immediate deletion of existing private backup files.

Preparation originally left cloud custody disabled. Approved activation enables the workflow and
creates a restricted Aiven backup role; the Codex heartbeat remains active during acceptance.
Role provisioning changes no source rows; acceptance uses an ordinary public analysis to exercise
populated restoration. Silly processes and public routing are unchanged. Stable public replacement, managed Free restore,
general capacity, Function suspension and deferred device/spoken acceptance remain separate gates.
