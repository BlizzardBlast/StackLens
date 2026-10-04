# ADR-0019: Restricted database login for request-bound APIs

- **Status:** Accepted implementation; activation requires exact-head CI and hosted validation
- **Date:** 2026-10-04
- **Requirements:** FR-003/004/017/021/022, NFR-008/009, SEC-003/007, GOV-006/007
- **Extends:** ADR-0014/0016/0018

## Context

Aiven Free has 20 server connections, including three superuser-reserved slots, and excludes
managed pooling. The existing shared login cannot alter its own connection limit. A transactional
NOLOGIN probe confirms it can create a constrained role and owns the application tables. A new
API login must not acquire schema-owner or Graphile migration privileges to start.

## Decision

Add an explicit `worker-managed` API database mode. Verify that the current reader can select all
required application columns without fetching rows. Fail startup if schema/permissions are missing.
Run no DDL, Graphile utilities or direct queue dispatch in this mode. Repository submission still
commits the analysis and outbox atomically before returning `202`; the continuous Worker alone
dispatches pending delivery, runs jobs, migrates schemas and performs retention cleanup.

Existing portable/bootstrap behavior remains the default. Vercel accepts only `bootstrap` or
`worker-managed` through `STACKLENS_DATABASE_MODE`. Deploy compatible code first, bootstrap schema
with the owner Worker, then activate the mode and constrained login together in the separate API
project. The static web never receives database credentials. No provider token enters the API.

The preview API login has a connection limit of six, no role/database creation or ownership, and
only CONNECT, public-schema USAGE, SELECT on the three application tables, and INSERT on analysis
and delivery. Grant no UPDATE, DELETE, schema CREATE, Graphile access or administrator membership.
Leave the Worker's existing owner login and maximum-five pool unchanged. Six API connections leave
11 ordinary server slots for Worker, provider/internal clients and operators. PostgreSQL's role
limit is approximate; this is an overload guard, not exact admission control or general capacity.

Never elevate the limited login to perform migrations. Future schema changes must migrate through
the owner Worker/operator before activating readers; permission changes need explicit review.
Rollback the API mode and login together to the reviewed owner/bootstrap deployment. Disable or
remove a retired limited role only after all deployments using it are retired; never terminate
unrelated sessions. Preserve historical report JSON and both strict schema readers.

## Verification and limits

Use an isolated owned PostgreSQL database and non-superuser role to verify denied DDL/Graphile
access, startup failure before schema bootstrap, durable submission while the Worker is stopped,
later Worker delivery, report polling, quick analysis and separate-pool saturation/recovery.
Hosted activation must verify TLS, effective privileges/limit, both direct and same-origin routes,
successful Worker delivery and idle connection retirement on the actual deployed revision.

Actual Vercel suspension, arbitrary workloads, public replacement routing and workstation-loss
recovery remain separate gates. The encrypted-backup heartbeat is best-effort local maintenance;
activation does not prove its first scheduled run or an always-on backup service.
