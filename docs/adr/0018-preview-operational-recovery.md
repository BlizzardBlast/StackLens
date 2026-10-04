# ADR-0018: Bounded preview operations and encrypted recovery archives

- **Status:** Accepted operator tooling; hosted connection ceiling remains blocked
- **Date:** 2026-10-03
- **Requirements:** FR-003/017/021/022, NFR-008/009, SEC-001/002/003/007, GOV-006/007
- **Extends:** ADR-0016 and ADR-0017

## Context

PR #41 merged as `33de1db44aa416f5d6cf4d39669eaef4feb7171d`. Its previous head has
identical tracked files, but both Vercel projects still track the release branch. Earlier serial
analyses, idle observations and same-service restore rehearsals leave deployment lifecycle,
aggregate connections and recovery after provider loss partly unverified.

The live PostgreSQL service permits 20 connections, including three superuser-reserved slots.
API and Worker share a non-superuser login with an unlimited role connection setting. A pool of
one per Function instance cannot bound aggregate autoscaling. Aiven rejects changing that login's
connection limit with SQLSTATE `42501`; its inspected user menu provides credential reset only.

## Decision

Add explicit operator scripts under `scripts/operations`, separate from application and analyzer
execution. Ordinary tests use synthetic data; live-provider and hosted measurements are opt-in.
Local destructive rehearsals require loopback PostgreSQL and create uniquely named databases.
Restore always creates a fresh owned database, verifies identity, and leaves the queue stopped.
Never restore over the source, automatically unlock jobs, or change public routing.

Log successful Vercel runtime initialization with only an event name, validated commit SHA or
null, and elapsed milliseconds. This measures runtime composition, not total platform cold-start
latency. No request, repository, credential or provider content enters the event.

Prepare a reversible shared-role connection limit of 14, leaving three ordinary slots and three
superuser-reserved slots outside that role's allocation on the measured service. Apply only with
adequate existing headroom and privileges; verify the resulting setting without terminating
sessions. The current login cannot apply it, so record the failed attempt and retain the gate.
PostgreSQL documents role limits as approximate; this is an overload guard and provides no
exclusive Worker reservation. A dedicated constrained API login or external connection broker
would need separate privilege, startup/migration and hosting validation. Do not grant broad
administrative membership or raise privileges to bypass this failure.

Use PostgreSQL 18 logical dumps with an exported repeatable-read snapshot and verified remote TLS.
Bound dump and fingerprint input to 128 MiB. Encrypt archives with AES-256-GCM and a separate
random 32-byte key. Authenticate format, creation time and a maximum 24-hour restore window.
Reject malformed, tampered, wrong-key and expired archives before target creation. Archives and
keys stay outside the checkout; credentials and plaintext temporary client files stay in a private
ignored directory. Operator scripts remove their transient plaintext and client files.

Before exposing a restored API, validate stored reports with the existing strict reader and finish
terminal expiry cleanup in batches. Preserve queued/running ownership. Replay copied work only
after actual original-executor exit, using ADR-0017's exact-owner recovery against the target.
Retain historical report JSON unchanged. Synthetic rehearsals verify an active copied job, a queued
job and pending outbox delivery on a separate PostgreSQL cluster.

Archive expiry is an operator retention policy enforced by the restore command, not cryptographic
erasure or automatic filesystem deletion. Run the authenticated `expire` command after expiry and
remove a dedicated obsolete key. No recurring backup/deletion schedule is activated by these tools.

## Consequences

A retained encrypted logical archive and an independently verified local restore provide a free
fallback for loss of the managed service while this workstation, key and unexpired archive survive.
They do not establish provider-managed restore, workstation-loss recovery, automated backup
freshness, replacement public hosting, routing cutover, exact Vercel suspension, or an SLA.

Resource captures retain failed attempts separately. A constrained soak verifies only its two
selected immutable repository revisions, workload count and limits; small remaining headroom cannot
establish arbitrary repository capacity. Device and spoken screen-reader checks remain deferred.

See [the operator runbook](../implementation/preview-operational-hardening.md) and its dated evidence.

## References checked on 2026-10-03

- [PostgreSQL role alterations](https://www.postgresql.org/docs/current/sql-alterrole.html)
- [PostgreSQL role connection-limit semantics](https://www.postgresql.org/docs/current/sql-createrole.html)
- [Vercel concurrency scaling](https://vercel.com/docs/functions/concurrency-scaling)
- [Aiven Free PostgreSQL](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
