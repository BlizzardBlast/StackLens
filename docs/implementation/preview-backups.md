# Preview backup and recovery policy

> **Status:** Independent recovery, scheduled refresh and operator expiry cleanup verified; Free managed fork rejected\
> **Date:** 2026-10-04\
> **Requirements:** FR-003/004, SEC-003/007, NFR-008/009, GOV-002/007

## Current schedule and limits

Aiven's existing Free PostgreSQL service already takes managed daily backups. On October 3 its
Backups page initially listed snapshots at October 1 12:33:43 UTC and October 2 07:58:08 UTC, in
`do-blr1`, totalling 68 MB. A later Chrome refresh also listed October 3 07:58:06 UTC and 103 MB
total, meeting the 24-hour freshness target at observation. No paid service, card, new credential
destination or custom scheduler was added.
The [PostgreSQL backup documentation](https://aiven.io/docs/products/postgresql/concepts/pg-backups)
describes encrypted daily backups and WAL uploads every five minutes or completed WAL file.
That upload interval is not a measured recovery-point guarantee for this preview.

The [Free tier documentation](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
includes backups but prohibits forking to a Free plan. The backup retention table does not name
this Free plan. Visible snapshots establish their presence, not a guaranteed retention window.
The October 4 submitted Free fork is rejected by the backend, as recorded below.
Do not select a paid fork as a workaround for the user's no-card/no-paid-plan constraint.

Keep the provider's automatic schedule active. Before a release, verify the latest completed
snapshot is less than 24 hours old and record its timestamp. Treat 24 hours as a preview backup
freshness target, not a service SLA. Investigate an older snapshot before relying on it for recovery.
Confirm the actual plan's retention and an affordable recovery destination before declaring
disaster recovery ready. A managed backup list alone does not close that gate.

## Restore verification

Repeat the [isolated restore procedure](worker-recovery.md#repeat-the-restore-rehearsal) before
database/schema or runtime changes that affect restore compatibility. Use PostgreSQL 18 clients,
certificate-verified TLS and a consistent exported snapshot. Restore into a fresh, explicitly
owned database; verify its identity before changing its empty schema. Compare application and
Graphile table hashes, strict report reads and API readback. Never run the copied queue against
the live source or unlock a live Worker.

The October 3 rehearsal restored four schema 2.0.0 reports and matched all seven recorded table
hashes. Dump plus restore took 32.18 seconds; strict readback and teardown finished in 38.48 seconds.
These are timings for a small logical copy into the same running Aiven service. They do not measure
managed-backup restoration, service replacement, routing changes or disaster recovery time.
The private dump, client settings, CA copy and owned restore database were removed after validation.
At that capture there was no retained logical archive or newly activated off-provider backup destination.

The [later hardening rehearsal](preview-operational-hardening.md) retains a 705,390-byte
AES-256-GCM logical archive outside the checkout with a separate protected local key. It restored
all 11 stored reports onto a separate local PostgreSQL 18 server, matching all seven table
fingerprints and passing strict report reads. Its restore window expires October 4 at 20:44:31
Jakarta. This supplies a free local fallback while the workstation/key/archive survive; it does not
recover from workstation loss or establish an automatic refresh schedule.

Operator tools authenticate the archive and its maximum 24-hour retention before any target
mutation, restore into a fresh UUID-owned loopback database, keep the queue stopped and finish
expired terminal cleanup in batches. A separate synthetic rehearsal proves copied active/queued/
outbox recovery after actual original-executor death, including API readback and historical report
preservation. No live source queue was unlocked. Follow the hardening runbook for commands and
source-bound evidence. Refresh before expiry or use authenticated archive deletion afterward;
expiry rejection alone does not delete files. Remove the dedicated obsolete key separately.

## Expiry and recovery boundaries

On October 4, a new encrypted archive restored all eight currently retained reports on a separate
local cluster with matching fingerprints and API readbacks. Its restore window ends October 5 at
07:24:01 Jakarta; see the [publication evidence](release-evidence/2026-10-04-publication.json).
The earlier unverified candidate remains separate. The active Codex heartbeat
`stacklens-encrypted-preview-backups` runs every 12 hours in this chat to refresh, verify and delete
authenticated expired managed archives, preserving shared keys until no archive uses them. Existing
database settings are kept in the protected local `.stacklens/operations/database.json` outside Git.
The heartbeat requires this workstation, Docker, repository and credentials to remain usable; its
first scheduled refresh is verified below. Routine success stays quiet; actionable failure or expiry is reported.

Anonymous live analyses have a 24-hour lifetime. Provider backups can include older records until
the provider's backup retention expires. Keep archives private and finite; do not publish report
contents, database credentials or dumps as release evidence. During an eventual recovery, finish
expiry cleanup before opening the restored API publicly, preserving queued/running ownership as
required by SEC-003. Confirm the original executor is dead before any targeted queue recovery.

Release evidence records counts, hashes, timestamps and safe failure codes. The current policy
documents the observed managed schedule, retained encrypted archive and independent local recovery.
Guaranteed Free managed retention/an eligible restore destination, scheduled expired-archive
deletion, replacement compute and workstation-loss recovery remain explicit acceptance gaps. Synthetic copied-queue
replay closes only its local scope.

## October 4 independent public replacement and refresh

The [independent rehearsal](independent-preview-recovery.md) restores the verified archive on
Neon Free PostgreSQL 18. After six expired terminal rows are removed, both retained reports are
served unchanged through the public API and web proxy; two fresh hosted Worker jobs also finish.
The original executor is offline before the target starts. Routing returns to Aiven and fresh
delivery passes before the owned target/project and temporary credentials are removed. This
reuses existing Vercel/Silly compute and an operator-held archive/key; it does not prove loss of
those resources or provider-managed restoration.

Legacy migration fingerprints differed because of provider collation. The unchanged source
matches the archived legacy hash, and canonical source/target hashes match. Future captures fix
`C` ordering and UTC with `postgres-jsonb-c-v1`; historical captures remain unchanged. The legacy
comparison required the surviving source, so it is not an independent legacy archive guarantee.

After rollback, `preview-20261004-post-recovery.slbackup` captures all three current reports with
its dedicated `preview-20261004-post-recovery.key`. It is 206,693 encrypted bytes, restores on a
separate local PostgreSQL server with all seven matching canonical hashes and three strict/API
readbacks, and expires October 5 at 13:03:00 Jakarta. Both files have user-only Windows permissions
outside Git. The owned verification database/container/volume and transient plaintext are removed.
Earlier unexpired archives and the shared October 4 key retain their finite windows; the heartbeat
must preserve a shared key until no remaining archive uses it. At this capture the first scheduled
run was unverified; the later result follows.

## October 4 first scheduled refresh and managed-backup inspection

The existing heartbeat completes its first scheduled refresh at 13:22 UTC (20:22 Jakarta).
Its new 206,693-byte encrypted archive restores all three reports into an owned local PostgreSQL 18
database with the queue stopped, seven matching canonical table fingerprints and three strict/API
readbacks. All owned resources and transient private files are removed. This follow-through
independently checks the archive SHA-256, reviewed operator hashes and completed automation result;
the restore itself is the scheduled run's recorded execution. The archive expires October 5 at
13:21:55 UTC (20:21:55 Jakarta). Its unique archive/key remain in the protected directories outside
Git. Five archives authenticate, but none is expired at execution, so no archive or key is deleted.
The shared October 4 key remains intact. Scheduled refresh is verified for this run; scheduled
expired-archive removal and workstation-loss recovery remain unverified.

At 13:34 UTC, Aiven's Free service lists four managed snapshots in `do-blr1`, totalling a displayed
139 MB. The latest is October 4 at 07:58:10 UTC (35.7 MiB); the others are October 3 at 07:58:06,
October 2 at 07:58:08 and October 1 at 12:33:43 UTC. The latest meets the 24-hour freshness target.
The observed three-day span does not establish a guaranteed retention window.

The current fork form selects `Free-1-1gb` and displays a Free monthly price. This conflicts with
the current [Free-plan restriction](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
against Free forks and its one-service-per-type limit. The
[retention table](https://aiven.io/docs/products/postgresql/concepts/pg-backups#backup-retention-time-by-plan)
still does not name Free. The form is closed without submitting or creating a service. Eligibility
and managed restoration remain unverified; a UI offer does not override backend policy or the
user's no-paid-plan constraint. The safe counts, hashes, timestamps and observations are in the
[follow-through evidence](release-evidence/2026-10-04-capacity-follow-through.json).

## October 4 operator refresh, natural expiry cleanup and Free fork rejection

After PR #46 rollout, an authorized operator invokes the existing scheduled maintenance procedure.
This execution is recorded as `scheduled: false`; the 12-hour heartbeat and its first scheduled
refresh are unchanged. The consistent source snapshot contains five analysis rows, four completed
reports and one active queue row. A fresh owned local PostgreSQL target restores all four reports
with seven matching table fingerprints and four strict/API readbacks. Its copied queue stays
stopped and no source claim is unlocked. This does not prove replay of that copied active row.

The 275,302-byte encrypted archive has user-only permissions, certificate-verified source TLS and
expiry October 5 at 14:44:50 UTC (21:44:50 Jakarta). All owned pools, API, database, container/volumes
and transient private files are removed. Authentication checks six managed archives after refresh.
`preview-20261003.slbackup` has naturally expired at October 4 13:44:31 UTC; maintenance removes it
and its dedicated key. Five unexpired archives remain; the October 4 shared key stays intact until
neither associated archive survives. No expiry is extended and no unexpired archive is deleted.
This verifies deletion by an operator run of the scheduled procedure. Scheduler-fired expired
deletion remains unobserved and should be checked from the next applicable heartbeat record.

The Aiven fork form still selects `Free-1-1gb` and shows a Free monthly price. Submission of an
owned temporary restore-check name with that selection returns the backend message
“Forking to a free plan is not allowed.” The form is cancelled. A subsequent project listing
contains only the original running Free PostgreSQL service. No fork or paid service is created.
This resolves the UI/documentation ambiguity: the displayed Free fork path is unavailable on the
current service. A managed restore still has no verified eligible zero-cost destination, and the
Free retention guarantee remains undocumented. The independent logical recovery rehearsal remains
the verified fallback while its operator archive/key and existing compute survive.

The [rollout evidence](release-evidence/2026-10-04-capacity-rollout.json) preserves safe capture
hashes, backup/restore counts, authenticated expiry metadata and the backend rejection separately
from the earlier unsubmitted-form observation. Replacement compute and workstation-loss recovery,
actual Function suspension and user-deferred manual acceptance remain open.
