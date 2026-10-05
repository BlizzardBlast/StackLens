# ADR-0021: Encrypted recovery handoff to replacement compute

- **Status:** Accepted preparation; live secret activation requires operator approval
- **Date:** 2026-10-05
- **Requirements:** FR-003/017/021/022, NFR-008/009, SEC-003/007, GOV-006/007
- **Extends:** ADR-0017/0018/0020

## Context

The independent database rehearsal restored reports through the existing Vercel API and Silly
Worker. Both the encrypted archive and its key remained on the operator workstation. Losing
that workstation or the existing compute is a separate recovery failure.

## Decision

Separate capture and recovery into independent processes and GitHub-hosted jobs. Rebuild trusted
StackLens source and its locked dependencies on the replacement runner; transfer only two explicitly
named ciphertext files. The database archive retains ADR-0018's authenticated 24-hour window.
Encrypt the recovery manifest with the same AES-256-GCM envelope and a separate random nonce.
The manifest binds the archive hash, canonical table fingerprints, source commit, source run,
scope and executor receipt. Authenticate both files and equal expiry headers before creating
any database. Keep identifiers, report bodies, keys and connection settings out of artifacts/logs.

Normal PR verification uses public synthetic data and a clearly identified public fixture key.
Its source executor is an actual child process, confirmed exited before sealing the receipt.
Capture includes active/queued jobs, pending outbox delivery and an expired report. The source
job tears down its own database before the recovery job begins on a fresh runner. Recovery
unlocks only that authenticated fixture owner on the copy, validates strict readers and fingerprints,
completes terminal expiry cleanup, and exercises compiled API/Worker execution over loopback HTTP.
Historical reports are never rescored. The fixture key is explicitly rejected for preview scope.

Prepare a separate manual-only workflow restricted to this repository's `main` ref and a protected
`preview-recovery` environment. Activation is a new secrets destination and requires operator
approval. Capture alone receives the paired verified-TLS database configuration; recovery receives
only the dedicated recovery key. Default token permissions are contents/actions read. Action
versions are pinned to verified upstream commits; checkout does not persist Git credentials.
Never expose these secrets to PR events or load code from the encrypted artifact.

Preview capture requires explicit confirmation that original API and Worker compute are offline
and submissions paused. Check the database is drained before and after snapshot acquisition.
Reject any in-flight analysis, queue row or undelivered submission. Never unlock copied live claims.
Recovery may read a previous same-repository run within its authenticated window and does not
contact the original database or hosting resources. Always restore into a UUID-owned loopback
PostgreSQL 18 database; no public route, live target, paid plan or automatic failover is created.
Replacement runtimes use synthetic providers for new-work verification; they do not execute
analyzed repository code. Owned databases, processes and private client files are removed on
success and failure. Docker's loopback host alias is supplied explicitly on Linux runners.

## Limits

GitHub is a separate recovery dependency, requiring account access and the protected secret to
survive. Artifacts request one-day storage retention; platform deletion timing is not an exact
24-hour guarantee. Restore eligibility ends at the authenticated deadline regardless of download
availability. This manual workflow is not a scheduled offsite-backup policy.

Fresh-runner fixture acceptance proves portable runtime recovery. Live archive activation,
recovery of preview data, stable public replacement hosting and a cutover/rollback exercise remain
separate operator gates. Managed Aiven Free restoration, Function suspension, general capacity
and user-deferred device/spoken acceptance are unaffected.

See the [portable recovery runbook](../implementation/portable-preview-recovery.md).
