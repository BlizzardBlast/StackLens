# Scheduled offsite preview backups

**Prepared:** October 9, 2026. **Status:** implementation preparation; live activation and scheduled
acceptance pending. **Traceability:** NFR-010/009, SEC-003/007, FR-003/017/022; ADR-0022.

## Scope and boundaries

The existing Codex heartbeat captures and verifies a backup every twelve hours on the workstation.
The new `.github/workflows/offsite-preview-backups.yml` prepares a replacement using GitHub-hosted
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

Capture runs at `01:17` and `13:17` UTC (`08:17` and `20:17` WIB), requesting one-day artifact
retention. Each envelope still has an authenticated maximum 24-hour restore window. Verification
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

## Concrete activation and Codex scheduler handover

1. Review and merge [PR #53](https://github.com/BlizzardBlast/StackLens/pull/53) from
   `codex/offsite-preview-backups`. Resolve the current main
   SHA, exact-head quality and two-job offsite fixture CI before live use. Do not enable the variable
   on a branch or change the old recovery environment's required reviewers.
2. Obtain approval for unattended access in two new environments restricted to `main`, without a
   per-run human reviewer: `preview-offsite-capture` and `preview-offsite-readback`. Capture holds
   `STACKLENS_BACKUP_DATABASE` (the existing paired verified-TLS source configuration) and
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

Preparation leaves the Codex heartbeat active and changes no GitHub environment/secret/variable,
Aiven data, Silly process or public routing. Stable public replacement, managed Free restore,
general capacity, Function suspension and deferred device/spoken acceptance remain separate gates.
