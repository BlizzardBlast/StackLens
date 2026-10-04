# Preview backup and recovery policy

> **Status:** Managed schedule and encrypted separate-server restore verified; public disaster recovery remains open\
> **Date:** 2026-10-03\
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
this Free plan. Two visible snapshots establish their presence, not a guaranteed retention window.
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
first scheduled run is unverified. Routine success stays quiet; actionable failure or expiry is reported.

Anonymous live analyses have a 24-hour lifetime. Provider backups can include older records until
the provider's backup retention expires. Keep archives private and finite; do not publish report
contents, database credentials or dumps as release evidence. During an eventual recovery, finish
expiry cleanup before opening the restored API publicly, preserving queued/running ownership as
required by SEC-003. Confirm the original executor is dead before any targeted queue recovery.

Release evidence records counts, hashes, timestamps and safe failure codes. The current policy
documents the observed managed schedule, retained encrypted archive and independent local recovery.
Confirmed Free retention, demonstrated scheduled refresh/deletion, replacement public API/Worker hosting
and routing cutover remain explicit acceptance gaps. Synthetic copied-queue replay closes only its
local recovery scope, not provider-managed or public disaster recovery.
