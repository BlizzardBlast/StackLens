# ADR-0022: Scheduled offsite preview backups

- **Status:** Accepted and activated; scheduled live acceptance and scheduler handover pending
- **Date:** 2026-10-09
- **Requirements:** NFR-010, NFR-009, SEC-003/007, FR-003/017/022, GOV-006/007
- **Extends:** ADR-0018/0021

## Decision

Use separate scheduled GitHub-hosted capture and verification jobs. Online capture reuses the
read-only consistent PostgreSQL snapshot; it neither pauses submissions nor stops the existing
Worker. Its new `online-backup` manifest is incompatible with the offline/drained recovery bundle.
The verification job receives only ciphertext and key custody, never the source database login.
It authenticates repository/run/scope/digest/equal deadlines before local target I/O, compares seven
fingerprints, strictly reads archived reports, purges terminal expiry, and validates remaining
reports through the API. Zero report coverage is explicit. It starts no Worker or delivery pump,
unlocks no copied claim, publishes no connection file and removes its owned target on every path.

A dedicated 32-byte master secret stays in separate capture/readback GitHub environments. Derive
per-run AES-256-GCM keys with HKDF-SHA256 using purpose, scope, repository, run and source commit.
The master, derived keys and source configuration never enter artifacts. A separately derived
HMAC key authenticates each artifact's retention label, binding repository, run, commit, archive
digest and exact envelope timestamps. This permits authenticated expiry cleanup without downloading
private database content. Root-key rotation must preserve all still-eligible archives; it is not
per-archive cryptographic erasure. The authenticated restore window remains at most 24 hours.

Capture is scheduled twice daily, away from the hour boundary. An hourly maintenance run removes
only expired labels authenticated under the dedicated key and bound to this repository's trusted
main-branch backup workflow. Unrelated or unauthenticated artifacts are preserved. A usable backup
also needs the owning workflow's verification job to have succeeded and its artifact to exist.
Reject a latest verified capture older than 18 hours, allowing six hours beyond the 12-hour cadence
while leaving six hours before normal expiry. Failure is visible in Actions and source-free evidence.
GitHub scheduling is best effort; this detector is not an independent guarantee if GitHub itself
stops scheduling. Artifacts additionally request one-day retention. Neither API deletion nor the
retention setting proves exact physical deletion timing at the provider.

## Activation and scheduler handover

The live workflow is main-only, contains no PR-triggered secrets and is disabled by default behind
`STACKLENS_OFFSITE_BACKUPS_ENABLED`. Prepare two new environments restricted to `main`: capture
has the verified-TLS source configuration and dedicated master; readback has only the master.
Unattended access requires explicit operator approval of this custody and protection policy.
The existing manually reviewed `preview-recovery` environment and workflow remain protected.
Fixture CI needs no secrets and uses only synthetic data on owned loopback databases.

The October 9 operator approval authorizes two unattended main-only environments and a new
restricted source login. Capture uses `stacklens_backup_preview`, with verified TLS, two connections,
schema usage and table/sequence SELECT. The role has no ownership, memberships, superuser,
database/role creation, replication or persistent write privileges; read-only transactions are its
default. Graphile's private queue tables enable RLS without reader policies, so complete `pg_dump`
requires BYPASSRLS. That attribute permits complete reads only where SELECT is granted; it does not
grant writes. An owner-exported snapshot confirms seven identical fingerprints, and pinned-client
write attempts remain denied after disabling the read-only default. Future schema or grants changes
require rechecking this scope. No PUBLIC grants or queue policies are changed.

The dedicated master also has a separate operator recovery copy in the existing protected
`preview-recovery` environment as `STACKLENS_OFFSITE_BACKUP_MASTER`. Its required reviewer and
branch protections remain unchanged. The live enable variable is now true; activation evidence
and scheduled acceptance are tracked separately in the runbook.

Keep the existing Codex heartbeat active until a real scheduled cloud capture, independent restore,
expiry cleanup and workstation-independent evidence pass. Then retire that heartbeat through the
Codex automation tool, preserving its historical results. No dual active schedule is the final state.
Publishing/activation, scheduled acceptance and retirement must be recorded separately from local
implementation tests. This change creates no new hosting account and makes no public routing change.
