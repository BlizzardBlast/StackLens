# Preview backup and recovery policy

> **Status:** Managed backup schedule observed; free disaster recovery remains open\
> **Date:** 2026-10-03\
> **Requirements:** FR-003/004, SEC-003/007, NFR-008/009, GOV-002/007

## Current schedule and limits

Aiven's existing Free PostgreSQL service already takes managed daily backups. On October 3 its
Backups page listed snapshots at October 1 12:33:43 UTC and October 2 07:58:08 UTC, in `do-blr1`,
totalling 68 MB. No paid service, card, new credential destination or custom scheduler was added.
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
There is no retained logical archive or newly activated off-provider backup destination.

## Expiry and recovery boundaries

Anonymous live analyses have a 24-hour lifetime. Provider backups can include older records until
the provider's backup retention expires. Keep archives private and finite; do not publish report
contents, database credentials or dumps as release evidence. During an eventual recovery, finish
expiry cleanup before opening the restored API publicly, preserving queued/running ownership as
required by SEC-003. Confirm the original executor is dead before any targeted queue recovery.

Release evidence records counts, hashes, timestamps and safe failure codes. The current policy
documents the observed managed schedule and repeatable logical restore. Confirmed Free retention,
a no-card recovery destination, a retained recoverable archive and full disaster queue replay
remain explicit acceptance gaps.
