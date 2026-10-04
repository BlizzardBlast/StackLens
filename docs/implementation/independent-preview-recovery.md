# Independent preview recovery rehearsal

> **Date:** 2026-10-04\
> **Status:** Independent public database replacement, original-host rollback and teardown verified\
> **Requirements:** FR-003/004/017/021/022, NFR-008/009, SEC-001/002/003/007, GOV-002/006/007\
> **Decision:** [ADR-0020](../adr/0020-independent-preview-recovery.md)

## Scope and target

The reviewed baseline is merged PR #44, main `3747cb9b2e7f9f173ae0288c0e03dd7f882b05a6`.
The API recovery deployments use `3747cb9`; the earlier `515576a` capture remains historical.
The original database is Aiven Free, with the restricted six-client API and continuous owner
Worker. Preserve that configuration for rollback.

Chrome confirms the newly owned Neon project `stacklens-recovery-20261004`,
`shy-leaf-33221079`, branch `br-jolly-term-b3wjnqce`, Free, AWS Singapore, PostgreSQL 18.6.
Only PostgreSQL is enabled. The creation form displays 0.5 GB storage; this observed allowance
governs the rehearsal despite newer advertised allowances. Default compute is 0.25–2 CU with
scale-to-zero and six-hour history. No card, upgrade, paid service or additional feature is enabled.

The approved direct endpoint is `ep-morning-lab-b3o7h48i.c-4.ap-southeast-1.aws.neon.tech`.
Its hostname certificate verifies against ISRG Root X1. The client TLS socket is authorized;
Neon's internal `pg_stat_ssl` reports no TLS for the backend connection behind its TLS-terminating
proxy, so that view must not be used as client-transport evidence. Owner settings stay in the
protected local `.stacklens/operations/neon-recovery-owner.json`, outside Git.

## Restore procedure

Build the workspace and run operator checks first. Use an unexpired authenticated archive and
its separate key. Select the exact owned project endpoint through Chrome and keep the connection
private. Use a direct connection, an explicit trusted root CA, and no URL SSL/host overrides.

```powershell
node scripts/operations/backup.mjs restore-neon `
  "$env:USERPROFILE/.stacklens/operations/neon-recovery-owner.json" `
  "$env:USERPROFILE/.stacklens/backups/preview-20261004-verified.slbackup" `
  "$env:USERPROFILE/.stacklens/keys/preview-20261004.key" `
  .cache/operations/neon-restore.json `
  ep-morning-lab-b3o7h48i.c-4.ap-southeast-1.aws.neon.tech `
  "$env:USERPROFILE/.stacklens/operations/neon-restored-owner.json"
```

The private output must not exist. The command creates its own `stacklens_restore_<UUID>`
database, verifies its empty schema and restores there. It never uses the original connection's
database as the restore destination. It rejects expired/corrupt archives before database access,
uses PostgreSQL 18 clients, validates historical reports and completes terminal expiry cleanup.
The queue remains stopped. Temporary decrypted/client files are removed; failure removes the
owned database and unfinished private output. Public evidence omits the connection string.

Compare all seven returned fingerprints with the archive's source-bound capture before any public
activation. Inspect copied job/lock/outbox state. Create and verify the restricted API login;
check missing-schema/DDL/Graphile denials, effective grants and connection limit. Verify restored
reports through the compiled API with Worker-managed initialization. Retain counts, hashes,
timings and safe failure codes only.

## Planned routing and rollback

1. Confirm original queued/running work has drained. Record the original Worker's exact identity,
   stop it in Chrome, and wait for confirmed offline and released owned database clients.
2. Save its existing private runtime settings for rollback. Replace URL and CA together with the
   owned target settings, preserving provider token/concurrency/retention and executable artifact.
   Do not unlock source or copied jobs automatically.
3. Start the hosted Worker against the target. Save paired restricted URL/CA only in the existing
   Vercel API project, keep `worker-managed`, and deploy reviewed compatible main. Confirm each
   private editor contains the intended exact value and closes after saving. Use a redeployment
   with the latest Project Settings and no build cache when validating a settings change. Ready
   alone is insufficient: verify successful runtime initialization and public HTTP readback. The web proxy
   continues to use the existing public API origin.
4. Validate restored public reports, direct/proxied quick analysis, and fresh repository submission
   through durable outbox/Worker/polling. Observe terminal limitations and final idle API clients.
   Record the actual routing interval and both deployed revisions.
5. Drain target jobs, stop and confirm its Worker offline, restore original URL/CA pairs, restart
   the original Worker and deploy the original restricted API settings. Verify restored source
   report availability and fresh public Worker delivery.
6. Verify target identity and absence of target clients, then remove only the newly owned target
   database/roles/project and private target configuration. Preserve the original source service,
   source roles and finite backup archive/key. Record teardown explicitly.

This rehearses planned replacement of the database while reusing existing compute. It does not
prove provider-managed restoration, loss of Vercel/Silly/workstation, automatic failover or RPO/RTO
guarantees. Real phone/spoken acceptance, general capacity and actual Function suspension remain
separate gates. The backup heartbeat's first scheduled execution is also unverified.

## Current verification

Endpoint/privacy/expiry/output guards and real failed-restore cleanup pass. The shared restore path passes the separate-cluster
synthetic rehearsal, including historical report preservation, terminal expiry and active/queued/
outbox replay after actual original-executor exit. The first normal parallel local test graph
hits two existing five-second persistence timeouts; assertions/timeouts are unchanged. The
uncached serial graph passes all 22 tasks, 560 Vitest tests and ten token tests. The full
database-backed `pnpm check` passes 11 operator checks and all 18 browser cases, native/compiled
smoke, types, lint and formatting. New lint findings are corrected at source before the passing run.

The authenticated archive restores eight strict reports on Neon. Expiry cleanup removes six
expired terminal records, leaving two valid reports, both readable through the compiled API.
Six legacy table fingerprints match directly. The legacy migration hash differs solely because
Aiven uses `en_US.UTF-8` ordering and Neon uses `C.UTF-8`; the unchanged source migration data
matches the archived legacy hash, and canonical source/target migration hashes match. Future
fingerprints use fixed `C` collation and UTC with explicit `postgres-jsonb-c-v1` evidence. A real
C/numeric-ICU and timezone regression test verifies equal canonical hashes. Historical captures
remain unchanged. This planned legacy comparison used the still-available source; future canonical
archives do not require that normalization against an online source.

The restricted target login has six connections, no administrator membership/DDL/Graphile/extra
write privileges, and the required reads/analysis-outbox inserts. Six held clients connect; the
seventh receives `53300`, owner access remains usable and all probe clients are released. The
original hosted Worker drains, reaches confirmed offline and releases its three owner clients
before the unchanged hosted artifact starts against the target. The copied queue/outbox is empty;
no unlock or source queue mutation is needed.

The API's manual recovery deployment `3QzJFyD2W1it2ESUeJsvPHxihiHn` is Ready at reviewed main
`3747cb9`, with its initialization event bound to that deployment (267 ms at 02:27:41 UTC).
The earlier PR #44 automatic deployment `8HEAymTbHQw9mL6b44wzDZz9h5Ej` is also observed Ready;
it predates the target configuration. Both retained reports read back unchanged through direct
and same-origin public routes. Post-backup source-only IDs correctly return 404 on the restored
target, demonstrating the finite recovery point rather than claiming zero data loss.

Fresh public `frey-ui` and `KerjaLog` jobs complete with schema 2.0.0 and explicit limitations in
149,718 ms and 113,726 ms. Their IDs exist in the target and are absent from the original source;
target queue owner `pool-c784f4ca3f6428d6c0` executes both. Actual web report rendering also passes.
The first probe's final single-sample all-backend idle assertion catches an owner transaction;
its failed capture is preserved. Follow-up sampling observes six brief owner transactions,
maximum age 514 ms, clearing between samples. A same-role inspection verifies zero API clients/
idle transactions, and the target has zero jobs, in-flight analyses and pending deliveries. This
is scoped API cleanup evidence, not a claim that continuous Worker transactions never exist.

## Original-host rollback and cleanup

The target drains and is confirmed offline before the original Worker settings/artifact restart.
The first rollback API deployments `4bcuiLsGAjCEskRDXMo7yfozNQoQ` and
`7fuUftNfRyZNh1JZFB7nuEGVwaGH` reach Ready but return startup `500`. The source reports remain
intact and the same restricted configuration passes compiled startup locally. Exact URL/CA input
comparisons and completed editor saves are checked privately. A rebuild with latest Project
Settings and no build cache, `4FdiXkS17osUsMnUJYb1vTosvLux`, passes public runtime checks.
The initial startup cause is unconfirmed; no certificate/TLS checks or role privileges are weakened.
This interruption is retained in the evidence and is not described as seamless failover.

Both original reports read back unchanged through direct/proxied routes, both target-only IDs
return 404, and quick analysis passes on both routes. Fresh KerjaLog analysis
`326d28a0-0b5b-4b6d-b753-f2629fc17324` completes with schema 2.0.0 and limitations in 122,478 ms,
owned by source `pool-a236e5b923b474c5f1`. It exists only in Aiven. Final same-role API inspection
shows zero clients/idle transactions, and the original queue is empty. Web deployment
`FfVmtM3tFrS52jwSuKCBahbiRWoK` is independently Ready at the same captured `3747cb9` revision.

The owned target database and role are removed with no target clients or work remaining and no
session termination. The first cleanup helper closes a pool twice after deletion; a separate
identity check confirms database/role absence before recording successful removal. Chrome then
confirms deletion of project `shy-leaf-33221079` and zero remaining Neon projects. Five temporary
target/Worker rollback files are removed; original Aiven settings remain protected outside Git.
Both owned local containers and their anonymous volumes are removed, unrelated volumes retained,
and no transient private files remain. The old target deployment's database credentials become
unusable after project deletion; existing deployment protection remains unchanged.

A fresh canonical encrypted backup restores all three current source reports with seven matching
hashes and three strict/API readbacks on a separate local server. Its dedicated archive/key are
user-only outside Git and expire October 5 at 13:03:00 Jakarta. The owned restore database is removed.
See the [safe source-bound evidence](release-evidence/2026-10-04-independent-recovery.json) and
[backup policy](preview-backups.md). Routing timestamps are observations of this planned rehearsal;
they do not establish exact failover time, seamless availability or recovery objectives.
