# Persistent preview recovery staging

**Prepared:** October 6, 2026. **Scope:** FR-003/017/021/022, NFR-008/009, SEC-003/007;
extends [ADR-0021](../adr/0021-portable-preview-recovery.md).
Published through [PR #51](https://github.com/BlizzardBlast/StackLens/pull/51); resolve its current
head, review and checks before using the helper against an approved hosted target.

The protected live capture and fresh-runner recovery pass through merged
[PR #50](https://github.com/BlizzardBlast/StackLens/pull/50). That workflow deliberately deletes
its isolated target. `scripts/operations/persistent-recovery.mjs` adds explicit staging into a
new owned database that remains quarantined for a later hosting exercise. Preparation and normal
tests create no public service, transfer no hosted credentials and change no public routing.

## Authenticated staging

Build the trusted checkout with `pnpm build` and prepare the official client with
`docker pull postgres:18-alpine` before binary backup/restore operations. Obtain the two named ciphertext files
`database.slbackup` and `recovery.slmetadata` from the approved same-repository capture run.
Keep the dedicated random key separate from the artifact. Use the authenticated capture run ID;
do not substitute the later recovery run ID. Verify current archive eligibility before staging.
The October 6 live archive expires October 7 at 11:41:06 UTC; this historical deadline does not
authorize extending it or using an expired artifact.

Create a private output directory outside the Git checkout, protected by the operator's account
permissions. POSIX files request mode `0600`; Windows operators must verify that directory's ACL.
The target owner configuration contains only `DATABASE_URL` and, for Neon,
`STACKLENS_DATABASE_SSL_CA`. Keep paired URL/CA values private. Use a separately approved direct
Neon endpoint and PostgreSQL 18 owner with permission to create a database; pooled endpoints,
other providers, query-string TLS overrides and mismatched hosts are rejected.

```sh
node scripts/operations/persistent-recovery.mjs stage-neon \
  /private/target-owner.json /private/capture-bundle /private/recovery.key \
  CAPTURE_RUN_ID EXACT_APPROVED_DIRECT_NEON_HOST \
  /private/restored-target.json .cache/persistent-staging-evidence.json
```

The private output and evidence paths must be new. Existing files are never overwritten.
`stage-local` accepts a loopback target owner configuration; use `-` in the hostname position.
Normal database tests use only owned local PostgreSQL databases and synthetic providers.

Before target I/O, staging authenticates preview scope, a private key, source run, archive digest,
equal envelope deadlines and the captured offline/drained receipt. The restore rechecks the
exact encrypted archive digest before connecting, so a file substitution between those reads
fails closed. It creates a UUID-owned database without overwriting any existing database.

Before publishing its private connection file, staging matches all seven canonical table
fingerprints to the authenticated manifest, purges expired terminal records, validates every
remaining report through the current/historical contract readers, and checks zero in-flight
analyses, queue rows and pending outbox records. It checks archive eligibility again immediately
before publishing. It starts no API or Worker, unlocks no copied claim and contacts no original
database. The published file is an operator connection file, not an approved API deployment login.

Success retains only the quarantined owned database and private connection file. Public evidence
contains status, source/run identity, digest, counts, retained-report hashes and quarantine facts;
it contains no database name, login, report identifier or body. Verification failure removes the
owned target and reserved connection file. Temporary dumps, client settings and CA copies are
cleaned up. Cleanup failure is reported as failure; preserve any saved private connection file
for operator inspection and removal of its owned database. Do not infer success from a file's
existence alone, or delete an arbitrary database based on a failed CLI receipt.

## Hosting availability and activation gates

On October 6, the signed-in Silly account offers a no-card Free Node.js plan. Creating the empty
`stacklens-worker-recovery` service receives the backend rejection: "There is no capacity available
to create a server right now. Please try again later." The form is cancelled; the original Worker
remains running. No replacement service, paid plan or additional account is created. The local
proof screenshot stays ignored; the source-free
[preparation record](release-evidence/2026-10-06-persistent-recovery.json) records the rejection.

The candidate public pair is an independent Vercel API project and a separate Silly Worker.
Silly's free public address offers plain HTTP rather than managed HTTPS, so it does not by itself
provide the accepted public API endpoint. Account/backend capacity must be verified before
activating either target. Neon Free currently allows 100 CU-hours per project per month and
scales to zero after five idle minutes. An always-connected Worker can prevent idling; 0.25 CU
for a full 30-day month would consume 180 CU-hours. Quarantined staging and a bounded public
exercise do not establish a continuously running free standby. Measure actual usage and agree
an operating budget before claiming lasting replacement availability.

Provider references checked October 6:
[Silly hosting](https://sillydev.co.uk/), [Silly terms](https://sillydev.co.uk/terms),
[Vercel limits](https://vercel.com/docs/limits), [Neon plans](https://neon.com/docs/introduction/plans).
Do not work around provider capacity through additional accounts or activate a card-required plan.

Once zero-cost compute is available, complete these steps as a separate approved operator exercise:

1. Resolve this milestone PR, current main, trusted deployment artifact hashes and current archive
   freshness. Record the exact replacement API/Worker/database destinations and credential scope.
   Obtain approval for those new credential destinations and public routing changes. Prior protected
   GitHub recovery approval covers its existing custody, not a different hosting destination.
2. Preserve current URL/CA pairs, login flags, aliases/proxy targets and verified Worker rollback
   artifacts. Fence original submissions and confirm original Worker exit and zero live ownership.
   Refresh the protected drained capture if the eligible artifact no longer represents the needed
   retained reports. Never reuse the old offline receipt as proof of current original executor exit.
3. Stage the authenticated bundle on the approved independent database. Create a restricted
   request-bound API role under ADR-0019; keep owner/Graphile credentials only with the Worker and
   operator. Purge naturally expired terminal records again immediately before exposure.
4. Install trusted API/Worker builds using normal provider adapters. Verify independent HTTPS/API
   readback, retained report hashes, anonymous expiry/no-store errors and a fresh durable repository
   submission. Record queue/outbox, connection counts, Worker resources and provider limitations.
5. Exercise the public alias/web-proxy routing and paired URL/CA rollback with submissions fenced.
   Confirm normal original delivery after rollback. Stop replacement compute, remove approved
   temporary credentials and drop only the identified owned target if the exercise is temporary.

Persistent hosted staging, public replacement, normal-provider delivery, usage allowance and
rollback remain unverified in this preparation. The full workstation-loss recovery claim also
needs recoverable operator access and approved offsite secret custody for this staging path.
Continuous offsite refresh/provider deletion, managed Free restore, actual Function suspension,
general capacity and user-deferred device/spoken acceptance remain separate gates.
