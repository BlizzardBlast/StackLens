# Worker lifecycle diagnostics and rehearsal

> **Date:** 2026-10-05\
> **Requirements:** FR-003/021, NFR-008/009, SEC-001/002/007, GOV-002/006/007

## Runtime observations

The executable logs `stacklens_worker_shutdown_requested` with the received SIGINT/SIGTERM and
`startupPending`. Startup registers its handlers before migration and still performs one cleanup
when a signal arrives during startup. Repeated signals share the existing shutdown request.

The optional runtime `onShutdownProgress` observer receives only fixed stage/state names and
monotonic elapsed milliseconds. Production emits `stacklens_worker_shutdown` JSON events.
Runner, delivery and retention start stopping together. Only after all three settle does cleanup
release Worker utilities, then close the database pool. Each stage reports its own result; the
executable reports successful completion only after the whole cleanup succeeds.

Pending stages emit `waiting` every five seconds through an unreferenced timer. This diagnoses a
stall without introducing a forced-exit deadline, abandoning queue writes or unlocking a live
owner. Errors retain existing safe executable summaries; stage events carry no error object,
database configuration, payload, provider body, report body or analyzed source. A diagnostics
callback failure cannot stop cleanup.

## Repeat locally

Build the trusted StackLens Worker and package its Linux dependencies:

```powershell
pnpm build
docker build --target worker -t stacklens-worker:lifecycle .
node scripts/prepare-silly-worker.mjs stacklens-worker:lifecycle .cache/operations/worker-lifecycle.tar.gz
$env:TEST_DATABASE_URL = 'postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens'
node scripts/operations/worker-lifecycle.mjs .cache/operations/worker-lifecycle.tar.gz .cache/operations/worker-lifecycle.json
```

Start the repository's local PostgreSQL with `pnpm dev:infra` first. The harness rejects a
non-loopback database URL, creates a UUID-named owned database for each case and removes its own
container, database and private environment afterward. The Linux panel image is limited to
256 MiB/no swap/0.25 CPU. Its observed startup command deliberately retains the quoted glob,
ts-node parent and outer shell. A separate native launch uses `exec node` under the image's init.

Synthetic transport is an operator-only Node preload mounted into these rehearsal containers.
It rejects unsupported endpoints, holds initial acquisition until cancellation and uses bounded
small registry responses on replay. Never mount it into a hosted Worker. No analyzed code,
package scripts, installs or tests are executed. The production analyzer and report reader remain
the same compiled code as the packaged artifact.

Five cases require zero exit status, complete cleanup observations and no OOM kill: idle panel
SIGINT, idle native SIGTERM, disconnected-database panel SIGINT, interrupted panel SIGINT and
interrupted native SIGTERM. Interrupted cases require the same analysis ID to become queued with
`repository_analysis_interrupted`, no report and no stale lock, then finish with a strict report
after restart. The report hash must survive the following stop unchanged.

A sixth negative control sends SIGTERM to the panel process group during an active fixture. Its
outer shell can exit with code 143 before Worker cleanup, leaving the delivery locked. This
records an ancestor-termination limitation; it is not a successful graceful stop. Removal targets
only the owned rehearsal container/database after confirmed exit, never a live preview owner.

## Hosted acceptance and limits

Drain the existing preview before routine maintenance and keep its current artifact available
for rollback. Verify actual offline before replacing files. After installing reviewed modules,
verify normal panel Stop logs its received signal, all cleanup stages and completion, then reaches
offline. Restart an interrupted public analysis under the same ID, compare retained report hashes
and verify the final queue is empty. Preserve private settings and concurrency one.

The [upstream Node egg](https://github.com/pterodactyl/generic-eggs/blob/main/nodejs/egg-node-js-generic.json)
configures `^C` for Stop; the observed startup command matches its quoted-glob launch behavior.
The source-tree harness reproduces this launch, but its successful local cases are not evidence
that the October 4 hosted Stop stall has been fixed. That stall's cause remains unconfirmed.
SIGTERM on a native Worker and termination of the panel's outer shell have different outcomes.
An offline panel badge alone cannot establish that final queue writes completed.

Record platform-start failures separately from application cleanup failures. The initial October 5 panel
rejected starting the unchanged Worker before Node launched and returned 504 from its file service.
The initial normal Stop reached offline; no deployment file was changed during that failed attempt.
After recovery, the original Worker starts unchanged and drains. PR #48's six compiled modules/maps
are installed only after confirmed offline and independently byte-compared after reload. Neither
startup nor private configuration changes. Active and idle normal panel Stops both deliver SIGINT,
complete all five cleanup stages and reach offline. Active runner cleanup takes 1,702 ms and idle
runner cleanup 198 ms; these are application stage durations, not exact process exit latency.
The interrupted frey-ui job returns queued with one unlocked delivery and no report, then completes
under the same analysis ID on restart. Both retained older reports preserve their hashes and the
new report survives the following idle Stop. Direct and proxied strict report reads, OpenAPI 3.1,
safe missing-analysis errors and an empty queue pass. The final Worker is restarted for preview use.

The [Linux lifecycle capture](release-evidence/2026-10-05-worker-lifecycle.json) records the final
source/archive hashes, five successful cases, separate abrupt-exit control and owned cleanup.
The [hosted attempt record](release-evidence/2026-10-05-worker-lifecycle-hosted.json) preserves
the platform block, failed earlier probes, engine recovery, retained-report hashes and full local
quality gate: 569 Vitest tests, 31 Node tests and 18 browser cases pass. The separate
[hosted rollout record](release-evidence/2026-10-05-worker-shutdown-rollout.json) binds the installed
modules to implementation commit `784b44a`, records hosted acceptance and retains the initial
failure. These checks do not establish abrupt host-loss recovery, arbitrary capacity or the cause
of the October 4 stall. See the [handover](../handover.md) for publication and remaining release gates.
