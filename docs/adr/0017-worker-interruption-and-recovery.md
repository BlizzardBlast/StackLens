# ADR-0017: Worker interruption and confirmed-exit recovery

- **Status:** Accepted
- **Date:** 2026-10-02
- **Requirements:** FR-003, FR-021, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-006
- **Extends:** ADR-0004 and ADR-0014

## Context

An active-job restart on the personal preview left KerjaLog running until 4 hours 10 minutes after
submission. The Worker did not consume Graphile's shutdown cancellation signal. The host also
loads JavaScript through ts-node because its startup expression compares the main filename with
the quoted literal `"*.js"`. This adds memory overhead on a 256 MiB host.

Graphile Worker 0.18 acquires jobs with its pool ID in `locked_by`; a worker log ID does not prove
the identity of that lock owner. Integration testing also found that its immediate, unbatched
completion/failure callbacks can outlive runner shutdown. Closing the shared database pool before
those writes finish can leave queue locks behind.

## Decision

Keep lifecycle and recovery in `apps/worker`. Register process shutdown handlers before startup,
stop queue acquisition immediately alongside maintenance pumps, and consume Graphile's job abort
signal after its one-second grace. Each executing job gets provider instances whose fetch transport
combines job cancellation with existing provider timeouts. Await the analyzer's actual termination;
do not race it against cancellation while leaving a writer alive. Interrupted attempts return to
queued state with `repository_analysis_interrupted`; the final attempt persists a public failure.
Never store a report generated after cancellation.

Configure zero-delay completion and failure batching so Graphile shutdown can await its queue
write releasers before the Worker closes the shared pool. Concurrent shutdown callers receive the
same completion promise. Log the exact pool owner ID as source-free operational metadata.

Serialize npm packument acquisition per job. This changes transport scheduling only; package
selection, response bounds, provider provenance, analyzer rules, priorities and scores stay the same.

On the constrained Silly Linux target, replace the ts-node child with native Node before opening
database connections. Keep the existing parent process and standard streams. Limit native V8 old
space to 96 MiB and omit source-map loading on this host; runtime errors remain sanitized. An 80 MiB
workload experiment stopped before completion and was rejected. These settings reduce overhead;
they do not promise arbitrary repositories will fit the host's 256 MiB allocation.

For abrupt exits, provide a separate operator command accepting exactly one
`--confirmed-dead-owner` ID. The operator must prove that the owning process has exited and match
the startup pool ID to the actual lock. Invoke Graphile's supported `forceUnlockWorkers` utility;
do not update private tables directly. Never infer targets from public progress, unlock all jobs,
or run the command automatically during ordinary startup. It has no public API route.

## Verification and limits

Provider tests verify cancellation, timeout-signal composition and npm scheduling. Database-backed
tests verify graceful retry with the same analysis ID, actual child-process death before recovery,
strictly read reports after restart, and preservation of a different live owner's lock. Hosted
activation still requires explicit resource and active-job restart evidence. A signal-aware stop
does not prove recovery from OOM, SIGKILL, host loss or a database outage. Those cases retain the
confirmed-exit operator procedure and need a running replacement Worker.
