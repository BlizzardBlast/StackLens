# Worker interruption and recovery

> **Status:** Implemented; local recovery, hosted active-job retry, expiry and restore verified  
> **Date:** 2026-10-02  
> **Requirements:** FR-003, FR-021, NFR-008/009, SEC-001/002/003/007, GOV-002/006/007

## Runtime behavior

`apps/worker` registers SIGINT/SIGTERM before startup and ignores repeated requests while stopping.
The runtime stops queue acquisition alongside delivery/retention maintenance. After Graphile's
one-second grace, its executing job abort signal cancels provider fetches, including their response
body reads, while retaining each provider's existing request timeout. Queued npm metadata requests
never start after cancellation. Full npm packuments are acquired one at a time per job to reduce
simultaneous JSON memory use. Analyzer selection and policy are unchanged.

An interrupted attempt becomes `queued` with `repository_analysis_interrupted`; it is returned to
Graphile for bounded retry. The final attempt stores a terminal failure. Cancellation never stores
a partial report. Shutdown callers share one promise, and maintenance/queue writes finish before
pool closure. Graphile 0.18 uses zero-delay completion/failure batching to give shutdown a releaser
that awaits final queue writes; its immediate callbacks can otherwise outlive the runner.

The Silly launcher replaces its ts-node child with native Node using Linux `process.execve` before
opening database connections. PID and standard input/output/error survive replacement. The
ts-node parent still exists; do not claim every loader process disappeared. The native child uses
96 MiB V8 old space and omits source-map loading on this constrained host. Ordinary native or
non-Linux launch continues to import the compiled entrypoint directly. The 256 MiB budget must be
verified with both real repositories; a startup-only memory measurement is insufficient.

## Planned stop

Drain active work before routine maintenance. A signal-aware stop can also interrupt active
provider work and return it for retry; verify the host actually reaches offline before updating
executable files. After restart, poll the same public analysis ID to terminal state and verify no
locks remain for that delivery. A platform's Restart button alone does not establish graceful stop.

## Abrupt exit

1. Confirm that the exact old process has exited. For the single-instance panel, verify offline and
   retain its startup `StackLens queue owner started (pool-...)` line. Never use elapsed public
   progress as proof of death, and never infer a queue owner from a `worker-...` logger label.
2. Read the affected job's actual `locked_by` owner through an authenticated operator connection;
   match it to the dead process. Graphile 0.18 normally locks by `pool-...`, even with concurrency one.
3. Run the separate one-shot command with that exact confirmed-dead owner:

   ```bash
   node --env-file=runtime.env dist/recover.js --confirmed-dead-owner pool-<exact-18-hex-digits>
   ```

4. Start the normal Worker and verify the same analysis ID finishes. Retain failure/provider limits.

The argument is an explicit operator assertion of death, not an automatic liveness check. The
command accepts one bounded pool/worker ID, calls the supported `forceUnlockWorkers` utility and
closes its one-connection CA-verified pool. It never modifies private queue tables directly. Never
target a live owner, a list/all jobs, or an ID found only through stale public status. There is no
HTTP recovery endpoint and no automatic startup unlock.

On Silly, the archive includes root `recover.js` for the panel's filename limit. Select it temporarily
with Additional Arguments `--confirmed-dead-owner <exact-id>` only after the above proof, then
restore `start-worker.js` and empty arguments before normal activation. Keep `runtime.env` private
with mode `0600`. The recovery command does not rotate or redistribute credentials.

## Evidence and remaining gates

Focused provider tests exercise cancellation and npm scheduling. Isolated PostgreSQL integration
tests exercise graceful retry, real child-process death before operator recovery, report contract
reading and a second live owner's lock remaining held. Test databases are removed after use.
The local Linux panel startup verification observes native Node, a remaining ts-node parent,
204.26171875 MiB cgroup peak, zero OOM events and a clean signal-aware stop. This proves startup
only. The final 96 MiB/native launcher completed frey-ui and KerjaLog under 256 MiB/no swap/0.25 CPU
with a 244.24609375 MiB cgroup peak, zero memory-limit/OOM events and clean exit. An uncapped run
completed but encountered memory-limit pressure; an 80 MiB experiment stopped without completing.
The selected configuration retains about 11.75 MiB measured headroom in this two-repository run,
not a guarantee for larger inputs or sustained workloads.

The hosted active-job stop reached confirmed offline in 22,379 ms. Its exact old pool owner released
the delivery, the public analysis returned to `queued` with `repository_analysis_interrupted`, and
no report existed for that interrupted attempt. A different pool claimed attempt two. The same
KerjaLog analysis finished in 192,798 ms from submission, with five limitations and no provider
failures. No administrative unlock was needed. This validates the panel Stop/offline/Start sequence;
it does not prove abrupt host-loss or automatic failover. Prefer draining for routine maintenance.

Remote retention fixtures establish scheduled deletion and cascade of an expired terminal report
and delivery, public lookup 404, and preservation of expired queued/running and null-expiry legacy
records. Fixtures were owned synthetic rows and were removed afterward. Fresh public submissions
receive 24-hour expiry. Backup restoration used a consistent PostgreSQL 18 snapshot into a separate
owned Aiven database: all application/queue table hashes matched and eight historical schema 2.0.0
reports passed strict repository and API reads without data rewriting. No replacement Worker was
started against that copy. The database and private dump were removed. This is an on-demand restore
rehearsal, not evidence of scheduled backup retention, RPO/RTO or queue replay after a disaster.

The live observations used an uncommitted change based on
`405b42046108367a374f73c923b1c60b397d28d6`. The hosted Worker was patched with compiled files and
launchers while Vercel web/API used that Git revision. The follow-up is published through draft
PR #41 under the existing release-branch approval. Resolve its current HEAD and actual deployments;
the earlier dirty-source hashes remain the timing/evidence basis. Record exact hashes and remaining gates in the
[recovery evidence](release-evidence/2026-10-02-worker-recovery.json). The database-backed
`pnpm check` passes, including 27 Worker tests. API startup tests now await their async continuation
before resetting module/environment state; API production behavior did not change.
Real phone/screen-reader acceptance remains open at the user's request, alongside another browser
engine, Function suspension/aggregate connection testing and an operational backup policy.
The temporary upload key was revoked: reuse returned 401 and the dashboard showed no API keys.
Private local credentials/restore files and disposable test databases/containers were removed.
Final review and documentation checks found no blocking issue in this bounded Worker change;
the general release gates above remain open and PR #41 stays draft/unmerged.
See [ADR-0017](../adr/0017-worker-interruption-and-recovery.md).

## Repeat the restore rehearsal

Use PostgreSQL 18 clients with private `PG*` connection settings and `PGSSLMODE=verify-full` plus
the approved CA file. Dump `public` and `graphile_worker` into a private custom archive using
`pg_dump --format=custom --no-owner --no-acl --schema=public --schema=graphile_worker`.
Keep any exported snapshot transaction open until the dump finishes. The October 2 rehearsal
compared source hashes in that same snapshot, so concurrent submissions could not skew comparison.

Create a new, uniquely named empty restore database. Verify `current_database()` equals that name;
never restore over the preview database. The dump includes `public` schema creation, so remove only
the fresh target's empty `public` schema before `pg_restore --no-owner --no-acl --exit-on-error`.
An earlier restore attempt rejected the existing empty schema and was discarded; the preview was
not modified. Compare table counts/hashes, read stored reports through shared contracts and the API,
and check that bootstrap/readback did not rescore or rewrite historical rows.
Do not start a Worker against a backup copy while the source Worker is live. A restored active
queue lock requires the confirmed-exit procedure and an explicit destination/replay plan.
Delete the owned rehearsal database, dump, CA and private client settings after recording sanitized
results. This procedure does not provision automated backups.
