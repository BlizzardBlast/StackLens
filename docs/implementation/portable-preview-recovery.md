# Portable preview recovery

> **Requirements:** FR-003/017/021/022, NFR-008/009, SEC-003/007, GOV-002/006/007  
> **Decision:** [ADR-0021](../adr/0021-portable-preview-recovery.md)  
> **Status:** Local and fresh-runner cloud fixture recovery verified; live activation pending

## What this verifies

The earlier [Neon rehearsal](independent-preview-recovery.md) depended on an operator-held
archive/key and existing Vercel/Silly compute. This path rebuilds compiled API and Worker on a
replacement runner and restores from ciphertext downloaded from GitHub. The source process and
database are absent by the time the recovery job starts. Recovery needs GitHub access, trusted
repository source, the encrypted bundle and its separately stored key.

The PR-triggered `portable recovery` workflow transfers only `database.slbackup` and
`recovery.slmetadata` between two fresh Ubuntu jobs. Fixtures include a completed report, an
expired report, an actively owned job, a queued job and an undelivered submission. Capture confirms
the original child actually exited and preserves the copied claim. Recovery authenticates archive
hash/scope/run/fingerprints/expiry, restores a fresh PostgreSQL 18 database, removes the expired
terminal record, unlocks only the copied fixture owner, and finishes all three pending jobs.
It then serves historical reports and completes one new durable submission over real loopback HTTP.
Only synthetic providers are used. No analyzed repository install/build/test is executed.

The preview path deliberately rejects in-flight work. Live copied claims are never automatically
unlocked or replayed. New replacement-runtime work remains synthetic; historical live reports
are strictly read and hash-compared without rescoring. This is isolated compute acceptance,
not stable public replacement hosting or a public cutover.

## Local verification

Build first. Use two separately owned local PostgreSQL 18 clusters and set `TEST_DATABASE_URL`
for each phase. Do not point these commands at a hosted service. The capture directory must not
already exist; restore creates a new UUID-owned database and never overwrites an existing one.

```sh
pnpm build
docker pull postgres:18-alpine
node scripts/operations/portable-recovery.mjs capture-fixture .cache/portable-bundle .cache/operations/portable-capture.json
# Stop/remove the owned source cluster if it is disposable; use the target cluster's URL next.
node scripts/operations/portable-recovery.mjs recover-fixture .cache/portable-bundle .cache/operations/portable-restore.json
```

The fixture key is public and contains no production value. Preview scope rejects it. Bundle
authentication tests run in `pnpm test:operations`; the full PR workflow supplies independent
Linux/Docker/build/runner coverage. The local run on October 5 restored seven matching table
fingerprints, removed one expired report, preserved one historical hash, replayed active/queued/outbox
work and completed five HTTP readbacks including fresh submission. Both phases removed their
owned databases and temporary private directories. This capture used dirty source on PR #48's
`de6b992` base; cloud acceptance must bind the published implementation head independently.

## Live activation checklist

Complete the reviewed code/CI gates before activating this new secrets destination. The prepared
manual `preview recovery` workflow runs only from `refs/heads/main` in `BlizzardBlast/StackLens`.
It never runs on a PR event. Configure an environment named `preview-recovery`, restrict deployment
branches to `main`, and require an available human approval rule. Verify the account supports
these protections; if it does not, leave activation blocked and choose a reviewed alternative.

After explicit operator approval, store these environment secrets through the hosting UI:

- `STACKLENS_RECOVERY_DATABASE`: private JSON containing only `DATABASE_URL` and
  `STACKLENS_DATABASE_SSL_CA`, with a certificate-verified source login authorized for logical
  snapshot/read access. Prefer a dedicated backup reader; do not grant new broad privileges to
  bypass provider limits. Never copy this value to repository files or the web project.
- `STACKLENS_RECOVERY_KEY`: a dedicated randomly generated 32-byte key encoded as 64 lowercase
  hexadecimal characters. Keep it independent of local backup keys and the artifact. Record its
  custody outside Git, without putting the value in evidence. Do not rotate it while a valid
  archive depends on it. The recovery job receives this secret but no original database login.

Activation approval includes these credential copies to GitHub, a bounded offline interval and
the live isolated rehearsal. It does not authorize a paid service, original queue unlock or
public routing replacement. The existing local 12-hour backup heartbeat is unchanged.

## Operator sequence

1. Verify source revision, reader compatibility and exact-head CI. Drain the public preview,
   pause submissions and independently confirm both original API and Worker compute are offline.
   A disconnected database session alone is insufficient proof of executor death.
2. On GitHub's **preview recovery** Actions page, run from `main`, choose `capture` and confirm
   `original_compute_offline` only after that observation. Approve the protected capture job.
   It checks drained state, uses verified TLS and exports a consistent read-only snapshot.
3. Approve the separate protected recovery job. It downloads the two encrypted files, authenticates
   them before database creation and verifies compiled replacement runtimes on a fresh runner.
   The target database is private and disposable; no existing host or routing setting is edited.
4. Check both jobs' source-free evidence artifacts: `status: verified`, matching fingerprints,
   strict historical readbacks, unchanged hashes, new durable completion and `cleanedUp: true`.
   Runner failure/cancellation is not successful cleanup evidence; service teardown still ends
   ephemeral resources, and the next attempt must use a fresh runner.
5. Restart original compute, restore submission availability and verify fresh normal public
   delivery. Capture hashes/counts/timestamps only. No report bodies or keys enter the PR.
6. To simulate workstation and original-compute loss later, choose `recover`, supply the earlier
   **preview recovery** run ID, and confirm original compute remains offline. No source login or
   workstation file is read in that recovery phase. A fixture artifact, wrong run, corrupt data,
   missing key or expired archive fails before mutation.

Both ciphertexts share the authenticated 24-hour restore deadline. GitHub artifact storage uses
`retention-days: 1`; deletion may occur later than that exact deadline. The tool rejects expired
content even when the platform still offers a download. This manual preparation does not establish
a continuously refreshed offsite backup or guaranteed physical deletion timing. Preserve these
limits when reporting workstation-loss readiness.

## Handover

Resolve this milestone's PR, dependency PR #48, current `main`, exact-head checks and deployed
revisions independently. No merge SHA placeholder is needed. Live environment secrets and
activation remain pending approval; do not infer that a prepared workflow has run against preview
data. Before public replacement acceptance, choose an approved zero-cost persistent compute
target and separately verify public routing, production providers and rollback. Keep managed Free
restore/retention, Function suspension, general capacity and device/spoken acceptance separate.

[PR #49](https://github.com/BlizzardBlast/StackLens/pull/49) publishes implementation commit
`a0bc39a` against dependency PR #48. Its initial quality and portable-recovery runs are
`37322070077` and `37322070076`; resolve final conclusions and the final branch head from the
[dated record](release-evidence/2026-10-05-portable-recovery.json).

The first cloud runs fail: guard tests assume `.cache` exists on checkout, and fixture capture
ends before handoff with successful owned cleanup. The October 6 correction creates the owned
parent and pulls `postgres:18-alpine` explicitly before binary dump capture. Docker download
messages must not be confused with PostgreSQL diagnostics; strict dump stderr checks remain.
Evidence now records fixed phase names and allowlisted failure codes. Keep failed runs separate
from the new acceptance result rather than rewriting them as successful rehearsals.

On October 6, implementation head `6e0aa90` passes [quality run 37453297502](https://github.com/BlizzardBlast/StackLens/actions/runs/37453297502)
and [portable recovery run 37453297494](https://github.com/BlizzardBlast/StackLens/actions/runs/37453297494).
Both fresh runners check out PR merge commit `53ebeb7`; the dated record binds that checkout to
the branch head and dependency base. Downloaded capture/restore evidence authenticates the same
archive and confirms matching seven-table fingerprints, one expired record removed, one historical
report unchanged, active/queued/outbox fixture replay, five HTTP readbacks and new durable work.
Both jobs clean up their owned resources; recovery does not contact the original database.
Quality passes 569 Vitest tests, 37 Node tests and all 18 browser cases plus runtime smoke, types,
lint and formatting. Local timeout attempts and successful isolated reruns remain separately recorded.
Resolve the final documentation follow-through head and checks in PR #49 before merging.
