# Worker capacity and response-stream memory

> **Date:** 2026-10-04\
> **Status:** PR #46 merged and deployed; bounded hosted burst verified, broader capacity gates remain\
> **Requirements:** FR-003/006/011/017/021, DATA-001/003, NFR-001/003/008/009,
> SEC-001/002/007, GOV-002/007

## Change and measurement boundary

The existing `worker-soak.mjs` operator harness now supports serial submissions, a simultaneous
burst, and a sustained window of three outstanding submissions. It measures durable creation-to-start
queue delay, execution and completion times, queued counts and database connections. Every accepted
submission must produce a contract-valid terminal report; a synthetic run additionally requires
identical facts/findings/recommendations/scores/limitations hashes and no provider failures.

The constrained process uses the existing compiled Worker runtime, task-list seam, production
orchestration and real provider adapters. An operator-only analyzer wrapper observes coarse phases;
it does not change analyzer policy. Synthetic HTTP fixtures have eight exact dependency declarations
and lazily stream 12 MiB npm responses in 16 KiB chunks, rather than allocating a large fixture body
in advance. Unknown fixture endpoints fail instead of falling through to external HTTP. Normal
correctness tests use small synthetic responses and never run a live soak.

Sampling every 100 ms records maxima for cgroup current memory, anonymous memory, file cache, Node
RSS, heap and external allocations by observed phase. Node's maximum RSS and cgroup `memory.peak`
are process/container lifetime counters, including startup. Synchronous allocations can fall between
samples. Each column is an independent maximum; adding anonymous/file maxima does not reconstruct
a simultaneous total. Database counts include the API, Worker and two operator observer pools.
The mounted host imports the production native runtime directly with the panel wrapper's 96 MiB
old-space limit; it does not measure the panel's transient ts-node replacement startup.

The shared provider response reader now iterates over chunks instead of building a recursive promise
chain. It keeps streaming UTF-8 decoding and the same byte limits, cancels failed/oversized bodies,
and releases the reader lock. Full JSON parsing and metadata validation remain unchanged. It still
requests complete npm metadata; no response limit, provider selection, finding, score, report schema,
Worker concurrency setting or public admission behavior changes.

## Captured results

All runs use the Linux panel image, 256 MiB memory/no swap, 0.25 CPU and a uniquely owned local
PostgreSQL database. The source-bound [evidence](release-evidence/2026-10-04-worker-capacity.json)
records archive and harness hashes separately from the clean base `378fd8a`.

| Workload | Jobs / Worker concurrency | Container peak | Process maximum RSS | Result |
| --- | --- | --- | --- | --- |
| Original reader, synthetic burst | 6 / 1 | 202.64 MiB | 155.52 MiB | All six reports equivalent; zero limit/OOM events |
| Iterative reader, synthetic burst | 6 / 1 | 192.30 MiB | 146.91 MiB | Same outcome hash as baseline; zero limit/OOM events |
| Iterative reader, synthetic burst | 6 / 2 | 198.85 MiB | 149.48 MiB | All six reports equivalent; zero limit/OOM events |
| Iterative reader, sustained synthetic window | 12 / 1 | 188.87 MiB | 148.08 MiB | All twelve reports equivalent; zero limit/OOM events |
| Iterative reader, live frey-ui/KerjaLog burst | 4 / 1 | 219.85 MiB | 183.26 MiB | Four strict limited reports; zero limit/OOM events |
| Reviewed harness, synthetic serial | 2 / 1 | 193.89 MiB | 150.79 MiB | Same outcome hash; separate observation/cleanup lists empty |

The first five profiles retain their original capture/harness hashes. The sixth verifies the
reviewed harness with its new evidence helper; its [follow-through record](release-evidence/2026-10-04-capacity-follow-through.json)
also records the scheduled backup and read-only hosting observations. It adds two jobs to the original
34-job capture set without reassigning historical measurements to changed harness source.

These are observations of one run per profile, not a statistically established memory or latency
guarantee. The first pair observes a 10.34 MiB lower container peak and an 8.61 MiB lower process
maximum RSS. File-cache variation contributes to container differences. Synthetic one-worker
execution takes 8.87–10.20 seconds per job in the first pair; two-worker execution takes
17.71–24.23 seconds on the same small CPU allocation. Keep the preview's existing concurrency one;
these measurements do not justify increasing it.

The live burst accepts four jobs together and completes each one. frey-ui uses immutable commit
`6dbd184ace64d28c6a7ca7c2c75263215f4ac9bf`; KerjaLog uses
`9e5f869bbcf5b9d582f8e1453395ea2c06c79f83`. Execution takes 71.56–98.59 seconds; the final job
finishes 323.89 seconds after durable creation, including queue wait. Both frey-ui reports retain
three typed `npm_response_too_large` failures and 24 limitations; both KerjaLog reports retain five
limitations and no provider failures. Repeated outcomes match within each repository. Security
scores remain the analyzer's supported-query interpretation, not proof that a repository is secure.
The sampled peak is eight database clients, including observers. Owned databases/containers and
private environment files are removed; all Worker exits are clean. No live-source queue is touched.

Synthetic large-readme responses do not represent every npm version graph, large source tree or provider failure pattern.
Only the workloads and revisions in the evidence are verified. General capacity, actual hosted
Function suspension, managed restore/retention and user-deferred physical-device/spoken acceptance
remain open.
The first scheduled backup refresh is now verified separately; no archive was expired at that run,
so scheduled expired-archive deletion has not yet been exercised.

## October 4 existing-service rollout

[PR #46](https://github.com/BlizzardBlast/StackLens/pull/46) merges as `7b5482038dd30f1a10982aa4ee15cfb53a272bef`
after exact-head CI `37208842717` and complete read-only agent self-review. Both Vercel projects are
independently Ready/Current in Production at that revision. The Worker is rebuilt from merged main,
packaged for native Linux extraction and installed on the existing service with concurrency one.
Four deployed module hashes match the packaged artifact; private runtime configuration and saved
startup variables match their previous values. The temporary installer/archive are removed and
the scoped deployment key is revoked, with subsequent access rejected by HTTP 401 and its local
private file removed. The preceding Worker package remains available for rollback.

The initial Stop and fallback Stop each exceed the 90-second observation deadline, before native
extraction or runtime/startup changes. Its failed capture remains recorded; the unreached
`configurationUnchanged: false` sentinel does not mean that configuration changed. A fresh drain
check finds zero queued/running analyses and zero Graphile jobs. Only then is the owned Worker
killed to reach offline; no live ownership claim is unlocked. Installation and normal startup then
pass. This interruption does not establish reliable graceful panel shutdown. If another planned
Stop stalls, recheck drain immediately before escalation and wait if new work appears.

Two public submissions are accepted together, one through each public origin. Both produce strict
schema 2.0.0 reports that read back identically through the direct API and web proxy:

| Repository | Queue wait | Execution | Total | Report limits |
| --- | --- | --- | --- | --- |
| frey-ui | 3.35 s | 167.72 s | 171.07 s | 24 limitations, three typed oversized-npm failures |
| KerjaLog | 175.33 s | 121.03 s | 296.36 s | Five limitations, no provider failures |

Immutable repository revisions are the same as the earlier local live capture. Three retained
reports remain unchanged. Both origins pass OpenAPI 3.1, a private no-store unknown-analysis 404
and strict quick-manifest readback. Across 177 requests and 104 resource/database samples, panel
memory reaches 169.20 MiB and total database clients seven. The host refreshes its counters;
network and polling extend the requested two-second sampling pause. This is a sampled peak, not
a cgroup lifetime peak or a paired comparison against the earlier local capacity profiles. Client
counts include observer overhead and the later overlapping backup operator. Final API clients and
API idle transactions are zero; the queue is empty and five terminal reports remain.

The [rollout evidence](release-evidence/2026-10-04-capacity-rollout.json) keeps artifact/module
hashes, the stalled Stop, successful installation, bounded workload and recovery checks separately
from the original measurements. A 1,181 ms deployed initialization event establishes startup only;
actual Function suspension remains unobserved. Aiven rejects the submitted Free fork, confirming
that route is unavailable. Operator backup maintenance restores four reports and removes one
naturally expired archive/key; scheduler-fired deletion remains a separate gate. See the
[backup policy](preview-backups.md) and [handover](../handover.md).

## Repeat the measurement

[PR #46](https://github.com/BlizzardBlast/StackLens/pull/46) publishes this milestone. Resolve its
merge state, current main and actual hosting revisions before subsequent deployment. Original
capture hashes remain authoritative for the measurements above. Follow the existing panel packaging/install procedure, preserve
private runtime settings and concurrency one, drain durable work before planned maintenance, and
verify deployed module hashes plus a bounded hosted burst after rollout. Complete rollout guidance
and remaining acceptance gates are in the [handover](../handover.md).

Build/package StackLens's reviewed code first using the existing
[panel packaging procedure](preview-operational-hardening.md#repeat-local-measurements).
Use a loopback `TEST_DATABASE_URL` whose local account can create/remove owned databases:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens'
pnpm build
docker build --target worker --tag stacklens-worker:capacity .
node scripts/prepare-silly-worker.mjs stacklens-worker:capacity .cache/operations/worker-capacity.tar.gz
node scripts/operations/worker-soak.mjs .cache/operations/worker-capacity.tar.gz 6 .cache/operations/burst.json burst 1 synthetic
node scripts/operations/worker-soak.mjs .cache/operations/worker-capacity.tar.gz 12 .cache/operations/sustained.json sustained 1 synthetic
node --env-file=.env scripts/operations/worker-soak.mjs .cache/operations/worker-capacity.tar.gz 4 .cache/operations/live-burst.json burst 1 live
```

Arguments after the output are optional: mode `serial|burst|sustained`, Worker concurrency `1|2`,
and providers `live|synthetic`. Existing invocations default to serial, concurrency one and live
providers. Counts stay bounded to 2–12, with a ten-minute observation deadline starting after each
API acceptance, including subsequent queue wait. Durations use persisted creation/completion timestamps.
The sustained profile replenishes at most three outstanding submissions. Docker requires cgroup v2
and the panel's Node 24 image. Synthetic mode passes no GitHub
token to the container. Live mode uses only the already configured public-repository token.

The harness stops/removes only its container, closes its pools, removes its uniquely owned database
and deletes its transient private environment file. It checks clean exit, resource counters and
sampling before accepting evidence; failed runs retain a safe phase/code and cleanup outcomes.
Observation failures are recorded separately from cleanup failures. Either rejects the run, while
`cleanedUp` describes resource teardown only, even if no valid shutdown measurement was available.
Keep raw captures and archives ignored; publish only selected counts, hashes, timings and numeric
resource observations. No repository source, provider body, credential or report body belongs in
release evidence.

## Verification and documentation impact

Four provider-stream regressions cover fragmented Unicode, exact byte bounds, advertised/streamed
oversize cancellation and transport-failure lock release. Five capacity checks cover bounded
workload options, fixture target/cancellation safety, actual provider-to-analyzer composition,
measurement failure with successful teardown and continued cleanup after a removal failure.
The database-backed `pnpm check` passes compiled/native runtime smoke, strict types, 16 operator
checks, the existing deployment checks, 22 Turbo test-graph tasks, all 18 browser cases, lint and
format. An uncached serial graph passes independently before the original full gate; the
follow-through gate reuses those 22 verified test tasks and runs all operator/browser checks afresh.

Requirements and architecture decisions are unchanged: this is a response lifecycle refactor and
an extension of ADR-0018's operator measurement seam. Contributor/operator guidance, provider
implementation documentation, README, the chronological journey and handover describe the change.
The original measurements precede deployment; the separate rollout above verifies the existing
preview. No accepted requirement, architecture decision, scoring, schema, design or token change
is introduced by the operational follow-through. README, hosting/backup guidance, journey and
handover include the new observations and remaining gates.
