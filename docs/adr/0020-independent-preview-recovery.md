# ADR-0020: Explicit independent preview database recovery

- **Status:** Accepted operator procedure; bounded public replacement and rollback verified
- **Date:** 2026-10-04
- **Requirements:** FR-003/004/017/021/022, NFR-008/009, SEC-001/002/003/007, GOV-006/007
- **Extends:** ADR-0017/0018/0019

## Context

The encrypted archive has passed a separate local restore, but the preview has not served a
restored database through its public API and continuous hosted Worker. Aiven Free cannot fork
to another Free service. The user authorized a temporary independent recovery rehearsal with
Neon Free, no card or paid plan, and Google Chrome for hosting controls.

## Decision

Keep the existing restore command restricted to loopback. Add a separate `restore-neon` operator
action that requires the exact approved direct AWS Neon hostname, explicit trusted CA and no
URL connection overrides. Reject pooled endpoints and arbitrary remote targets. Authenticate
the archive and its 24-hour restore window before any database mutation. Require PostgreSQL 18,
create a UUID-owned database from `template0`, verify its identity and empty schema, and restore
with `--no-owner --no-acl --exit-on-error`. Never replace an existing database.

Reserve the private output file exclusively before creating a database. Keep its connection
settings outside Git with user-only permissions. Remove temporary plaintext/client files on
every outcome and remove the newly owned database if restore or output writing fails. Validate
strict historical readers and compare all recorded table fingerprints before activating traffic.
Finish terminal expiry cleanup first; keep the copied queue stopped.

Fingerprint rows use fixed `C` collation and UTC with algorithm `postgres-jsonb-c-v1`.
Provider collation defaults can reorder otherwise identical JSONB rows. Preserve older captures;
when validating a legacy archive, establish matching source migration data and explicitly record
canonical comparison rather than rewriting its historical hashes or accepting an unexplained mismatch.

Use an isolated Neon Free project for the bounded rehearsal. This is a temporary replacement
database, not a change to the normal hosting selection or an always-on Free service guarantee.
Use direct connections for session-dependent Graphile operations, verified TLS and the existing
max-five Worker/max-one API pools. Create a constrained API login with ADR-0019's minimal grants;
do not give it Neon administrator membership or schema/queue privileges.

Drain and confirm the original hosted Worker is offline before starting a Worker on the copy.
Do not unlock a copied active claim unless its exact original executor is confirmed dead under
ADR-0017. A backup with no jobs requires no unlock. Change the existing approved API/Worker
database URL and CA as a pair, then deploy reviewed compatible API code. Verify both direct and
same-origin public routes, restored report readback and fresh durable Worker delivery. Record
the finite routing window and source/target identities without credentials or report bodies.

Return the preview to its original Aiven settings and verify fresh public delivery before
removing the owned recovery target. Deletion requires a fresh identity check and no target
Worker/API clients. Retain the original archive/key only through their authenticated finite
window. No automatic failover, public recovery endpoint, source queue unlock or routing change
is introduced by the restore command.

## Verification and limits

Normal tests exercise endpoint rejection, private diagnostics, expired/corrupt archive rejection
before network access, output preservation and failure cleanup. Separate local PostgreSQL 18
rehearsal verifies the shared fresh-database restore path, historical hashes, expiry cleanup and
copied active/queued/outbox recovery after actual original-executor exit. Live operations are
explicit and remain outside ordinary PR correctness tests.

Public restoration from an operator-held logical archive does not prove Aiven-managed restore,
workstation-loss recovery, an SLA, automatic failover, platform suspension or general capacity.
The running API and Worker still depend on their existing compute providers. See the
[independent recovery runbook](../implementation/independent-preview-recovery.md).
