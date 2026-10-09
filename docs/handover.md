# StackLens Session Handover

> **Prepared:** 2026-10-09\
> **Architecture:** v0.1.26; requirements v0.1.4\
> **Milestone:** Scheduled offsite backup preparation; live custody and scheduler handover pending\
> **Branch:** `codex/offsite-preview-backups`, existing checkout; [PR #53](https://github.com/BlizzardBlast/StackLens/pull/53) prepares offsite backups; resolve this milestone's publication state and current main\
> **Preparation base:** `1ac18f837aa65bb811ca5953730abddb93a0e50e`; independently resolve current main and hosting revisions\
> **Traceability:** FR-003/004/006/011/017/021/022, DATA-001/003, NFR-001/003/008/009/010, SEC-001/002/003/007, GOV-002/006/007

## Current handover

### October 9 scheduled offsite backup preparation

The user selects workstation-independent scheduled backups using the existing GitHub infrastructure
and asks whether the Codex scheduler should be removed. The new branch is
`codex/offsite-preview-backups`, in the existing checkout, with
[PR #53](https://github.com/BlizzardBlast/StackLens/pull/53). Resolve its publication state and current
main independently; local preparation is not live activation or scheduler-fired evidence.

NFR-010 and ADR-0022 define online consistent capture, a purpose-separated authenticated bundle,
separate key custody, per-run derived encryption, fresh-runner quarantined verification, authenticated
artifact labels, bounded expiry deletion and an eighteen-hour freshness gate. Verification starts
no Worker/pump and never unlocks copied claims. Report-count evidence distinguishes empty retained
coverage. New tests and a two-job public fixture workflow cover the same path with synthetic data.
The full database-backed `pnpm check` passes, including compiled runtime smoke, all eight new
focused cases and eighteen browser cases. Both workflows pass `actionlint` v1.7.12. The separate
focused gate and full gate remove their owned test databases; the temporary local PostgreSQL service
is stopped with the development volume preserved. Local evidence does not establish
fresh-runner cloud or scheduled live acceptance. See the
[preparation evidence](implementation/release-evidence/2026-10-09-offsite-backup-preparation.json).

Implementation head `1d098ca` passes quality `37861337919`, portable recovery `37861337909` and
the two-runner offsite fixture `37861337974`. Its downloaded synthetic restore receipt confirms
seven matching tables, two archived reads, one retained strict/API read, quarantined copied work
and complete cleanup. The later whole-second artifact timestamp correction passes all eight
focused cases again. Resolve final-head CI independently before merge. The read-only TLS scope
review confirms the current source login owns backup tables and can create roles/databases;
prefer restricted backup custody and obtain the explicit unattended policy choice before secrets
or hosted-role writes.

Follow the [concrete activation sequence](implementation/offsite-preview-backups.md#concrete-activation-and-codex-scheduler-handover).
The live workflow is disabled behind `STACKLENS_OFFSITE_BACKUPS_ENABLED`, with proposed main-only
`preview-offsite-capture` and `preview-offsite-readback` environments. Their unattended secret
policy needs explicit approval after review. The existing protected manual recovery environment is
unchanged. Record exact-head quality/fixture CI, manual live verification, a scheduled run without
workstation dependencies, applicable PC-off evidence and authenticated expired-artifact cleanup.
Retire `stacklens-encrypted-preview-backups` only after those gates, preserving historical results
and old archives' original expiry policy. It remains active during preparation. No new host research,
account, routing change or replacement Worker is part of this milestone.

Requirements v0.1.4 and architecture v0.1.26 add backup continuity without changing analyzer policy,
report contracts, scoring, UI or tokens. General capacity, managed Free restore, stable public
replacement, Function suspension and user-deferred device/spoken acceptance remain separate.

### October 6 persistent staging preparation

PR #50 passes exact-head quality `37459367556` and portable fixture run `37459367519`, with no
review submissions or threads, then merges as `3356493`. The original API and web proxy return
OpenAPI HTTP 200. The original Silly Worker is Running throughout this preparation.

The [persistent staging helper](implementation/persistent-preview-recovery.md) authenticates the
portable preview bundle before target I/O and rechecks the exact encrypted archive digest before
restore. It creates a fresh UUID-owned Neon/local database, checks all seven fingerprints, purges
expired terminal rows, strictly validates remaining reports and requires a drained copy before
publishing an exclusive private connection file outside Git. It starts no API/Worker, unlocks no
claim and changes no route. Eleven new checks pass, including real local PostgreSQL restoration,
one retained report, one expired removal and rollback of mismatched/undrained targets. All owned
test databases and temporary private files are removed. The
[preparation evidence](implementation/release-evidence/2026-10-06-persistent-recovery.json) preserves
earlier test attempts and source hashes; resolve final quality and publication checks independently.
Implementation head `298b96b` passes fresh quality `37466900165` and portable run `37466900182`.
Quality verifies the client-image prerequisite and all new staging checks on Linux; the full local
database-backed gate also passes 48 Node, 569 Vitest and 18 browser checks. Complete read-only
agent self-review approves preparation after the focused CI prerequisite correction. Resolve the
final documentation head and its checks from PR #51 before merging; no independent review is implied.

Two attempts to create `stacklens-worker-recovery` with the no-card Free Node.js plan receive
Silly's backend capacity rejection. Both forms are cancelled; no replacement service, paid plan,
new account or hosted credential destination is activated. The candidate public pair is an
independent Vercel API project and separate Silly Worker, subject to actual capacity. A quarantined
Neon database can idle; an always-connected Worker needs explicit usage validation because the
Free 100 CU-hour allowance is below a full month at 0.25 CU.

Next session: resolve [PR #51](https://github.com/BlizzardBlast/StackLens/pull/51) and current main, then verify zero-cost replacement
compute availability. Follow the concrete activation sequence in the runbook; identify the exact
database/API/Worker destinations before seeking new credential-custody and public-cutover approval.
Freshly fence original compute and verify drained state; the archived receipt proves only capture
time. Use an eligible current bundle, verify restricted API access and purge natural expiry before
public exposure, then exercise normal-provider delivery and paired URL/CA/routing rollback.
Persistent hosted staging and public cutover remain unverified. The current live archive retains
its October 7 11:41:06 UTC deadline; do not extend it or delete its key early. Continuous offsite
refresh/deletion, managed Free restore, Function suspension, general capacity and user-deferred
device/spoken acceptance remain separate. This handover requires no future squash SHA or second
post-merge documentation PR.

### October 6 approved live recovery

PR #48 merges as `085049d`. PR #49 retargets to `main`, resolves only squash-ancestry documentation
conflicts with an unchanged reviewed tree, and passes quality `37455506419` plus portable fixture
run `37455506484` before merging as `e619ed4`. The user explicitly approves protected environment
custody and the bounded live rehearsal. The `preview-recovery` environment allows only branch
`main`, requires reviewer `BlizzardBlast` and disables administrator bypass. The single-user
environment permits self-review; both protected jobs are approved under that user authorization.
Capture uses the existing verified-TLS owner/snapshot login without additional grants. Recovery
receives only the dedicated random key and ciphertext; its key custody copy stays outside Git.

[Live run 37457845053](https://github.com/BlizzardBlast/StackLens/actions/runs/37457845053) captures
the drained source while production API traffic is paused and the original Worker is observed
offline. Since Vercel pause leaves Preview Deployments available, the restricted API database
login is also temporarily disabled after recording its original state; it has zero clients.
No queued/running analysis, queue row or undelivered outbox record is present. Capture and recovery
both check out merged `e619ed4`. The second runner restores all seven matching fingerprints,
strictly reads one retained historical report without changing its hash, completes synthetic new
durable work and performs two HTTP readbacks. No live copied claim is unlocked. Both jobs confirm
complete owned cleanup; recovery contacts neither source database nor workstation files.

The archive is eligible until October 7 at 11:41:06 UTC (18:41:06 Jakarta). Preserve its dedicated
key until the authenticated window ends. The source-free
[live record](implementation/release-evidence/2026-10-06-live-recovery.json) retains source/job/
artifact identities, ZIP and archive digests, pause/restoration observations and public delivery
verification. The original API login, Worker and Vercel traffic are restored after cloud success.
The login fence lasts 339 seconds. A fresh normal-provider frey-ui analysis completes with schema
2.0.0, 24 limitations and three `npm_response_too_large` partial failures; its direct/proxied hashes
match. The historical report retains its hash. Final queue, locks, pending outbox and API clients
are zero. Both public origins expose OpenAPI 3.1 and private `404`/`no-store` missing-analysis errors.

Next session: verify PR #50, current `main`, hosting revisions and archive freshness.
Choose an approved zero-cost persistent replacement host and rehearse public routing plus normal
provider delivery/rollback before claiming full compute-loss recovery. A continuously refreshed
offsite archive and provider physical deletion policy are still needed. Managed Free restore/
retention, actual Function suspension, broader capacity and user-deferred device/spoken acceptance
remain separate. Existing local 12-hour backup scheduling and finite expiry are unchanged.

### October 5 portable replacement-compute preparation (historical capture)

The preparation state below precedes the October 6 approved live acceptance above. Its pending
activation instructions describe that earlier capture, rather than the current operational state.

[ADR-0021](adr/0021-portable-preview-recovery.md) separates encrypted capture from recovery on fresh
GitHub runners. Only the database ciphertext and encrypted authenticated manifest cross the job
boundary. The manifest binds source run/commit, scope, fingerprints, expiry and executor receipt.
Normal PR fixtures confirm actual source child exit before a copied active claim is unlocked.
Capture removes its source database before the replacement job begins. Restore validates all
seven fingerprints, strict historical readers and terminal expiry before starting compiled
API/Worker runtimes. It replays synthetic active/queued/outbox work, serves loopback HTTP readbacks,
completes a new durable submission and preserves historical hashes. Both phases remove their own
database and temporary private files. Linux Docker explicitly receives its missing host alias.

The local split-phase acceptance passes on separate PostgreSQL 18 containers. Six new normal
tests cover authentication/expiry/run/scope/receipt rejection and private cleanup/diagnostics.
The full database-backed quality gate and final published cloud fixture evidence are recorded in
the [portable recovery record](implementation/release-evidence/2026-10-05-portable-recovery.json).
Resolve their exact source heads independently; early local captures retain their dirty PR #48 base.

The first published cloud runs fail. CLI tests assume the ignored `.cache` parent exists; fixture
capture fails before handoff but confirms complete owned cleanup. The October 6 correction creates
the parent, prepares the PostgreSQL client image before capturing dump output, and records fixed
failure-stage names/allowlisted codes. Initial failures remain in the dated record. Resolve the new
exact-head quality and fresh-runner conclusions before marking this milestone ready.

October 6 follow-through verifies implementation head `6e0aa90` and PR merge checkout `53ebeb7`:
quality run `37453297502` and two-job portable run `37453297494` both succeed. Downloaded evidence
confirms the same authenticated archive, all seven fingerprints, expiry, historical preservation,
fixture replay, five HTTP readbacks and new durable work; owned cleanup succeeds on both runners.
All 569 Vitest, 37 Node and 18 browser tests pass in cloud CI. Local timeout attempts and isolated
reruns remain recorded. Resolve the final documentation head and its checks from PR #49 before
merging; this acceptance covers synthetic fixtures and leaves live activation pending.

The same documentation pass verifies the October 5 scheduler record: two strict/API report
readbacks, seven matching fingerprints, three authenticated expired archives and two keys removed,
with all owned verification resources cleaned up. The dated portable record retains the original
record hash and safe observations. This closes the older scheduler-fired expiry-cleanup gap;
check current archive freshness separately rather than relying on historical deadlines below.

The separate manual preview workflow is restricted to this repository's `main` and a protected
`preview-recovery` environment. It requires new secret-custody approval and original API/Worker
offline confirmation, checks drained state and never unlocks live copied claims. No environment
secret, hosting route or original database setting is changed by preparation. Recovery needs only
the separately stored key and encrypted artifact, and uses synthetic providers for new work.
Live preview-data recovery, persistent public replacement/cutover and continuous offsite refresh/
physical deletion policy remain gates. Existing local backup scheduling and finite expiry are unchanged.

Next session: resolve milestone PR #49 and dependency PR #48 before merging, then verify current
`main` and actual hosting revisions. Follow the [runbook](implementation/portable-preview-recovery.md)
for the concrete activation scope; do not treat fixture CI as live archive acceptance. No future
squash SHA or post-merge documentation PR is required. Managed Free restore/retention, Function
suspension, general capacity and user-deferred device/spoken acceptance remain separate.

### October 5 Worker lifecycle extension

The local change implements source-free signal receipt, startup-pending state and five cleanup
stages with per-stage elapsed time. Five-second waiting observations use unreferenced timers;
no deadline forces exit, skips queue writes or unlocks a live owner. Tests cover repeated signals,
startup interruption, diagnostics failure isolation and database-backed cleanup ordering.
The new [Linux rehearsal](implementation/worker-lifecycle.md) uses the packaged artifact under
the observed panel startup and a native launch, with synthetic provider transport only.
Idle stops, database disconnection, same-ID interrupted replay and retained report hashes are
verified. Terminating the outer shell with SIGTERM is captured as a separate abrupt-exit limitation.
It does not explain the October 4 stalled Stop, which remains unconfirmed.

An initial rehearsal failure and a Docker Desktop interruption remain separate failed captures.
After restarting the existing local engine, the owned residual container and database are removed;
the complete rehearsal is repeated against fresh owned databases. The final
[lifecycle capture](implementation/release-evidence/2026-10-05-worker-lifecycle.json) records the
source/archive hashes, cases and cleanup. No existing report is rescored or rewritten.

The full database-backed `pnpm check` passes build, compiled API/Worker smoke, type checking,
569 Vitest tests, 31 Node tests, 18 Chromium/Firefox/WebKit desktop/narrow browser cases, lint and
formatting. The Worker has 32 focused/integration tests. Unchanged package results may be reused
by Turbo. This local gate does not replace hosted acceptance or exact-head CI after publication.

The initial hosted attempt reaches offline after normal Stop, but subsequent file-editor requests
receive a platform 504 and starting the unchanged Worker fails before Node launches. No module or
setting is changed during that attempt. Two retained report hashes match and the queue is empty;
the preview is offline at that historical observation.
The [hosted attempt record](implementation/release-evidence/2026-10-05-worker-lifecycle-hosted.json)
preserves this failure and the local quality gate without rewriting its original state.

The platform subsequently recovers. The unchanged Worker starts and drains, its original compiled
files match the rollback artifact, and normal Stop reaches offline before activation. PR #48
publishes implementation commit `784b44a470c0a4470c6bd2781cb581f3fcf5643b`; exact-head quality CI
`37311623977` passes. The six changed compiled modules/maps are saved through the file editor,
reloaded and byte-compared. Startup and private configuration receive no writes; concurrency stays
one and no synthetic transport is installed. An active public frey-ui job stops with SIGINT,
all five stages complete and the panel reaches offline. The same ID returns queued with
`repository_analysis_interrupted`, one unlocked job and no report, then completes on restart with
schema 2.0.0, 24 limitations and three bounded npm-size failures. Both older hashes remain unchanged.
An idle Stop also completes every stage and reaches offline. All three strict reports have
identical direct/proxy readback while the Worker is stopped; both OpenAPI and safe missing-analysis
checks pass. The final queue has zero jobs/locks and the Worker is restarted for normal preview use.
See the [rollout record](implementation/release-evidence/2026-10-05-worker-shutdown-rollout.json).

Next session: resolve PR #48's final head/CI/review/merge state, current main and actual hosting
revisions independently. The deployed runtime code is bound to implementation commit `784b44a`;
later documentation-only commits do not require replacing the matching modules. Keep the PR #46
Linux artifact for rollback. Never mount the synthetic preload into a hosted Worker. This complete
handover needs no placeholder merge SHA or second documentation PR. Broader workstation/replacement
compute recovery, managed Free restore/retention, Function suspension and user-deferred manual
acceptance remain separate gates. The backup heartbeat and archive expiry policy are unchanged.

### October 4 hosted capacity rollout and recovery follow-through

[PR #46](https://github.com/BlizzardBlast/StackLens/pull/46) merges after exact-head CI `37208842717`
and complete read-only agent self-review. Both Vercel projects are independently Ready/Current in
Production at `7b54820`. The existing Worker now has the native Linux artifact built from that main
revision, four matching deployed module hashes, unchanged private settings/startup and concurrency
one. The preceding Worker package remains available for rollback. Temporary installer/archive and
the scoped deployment key/private file are removed; revoked access subsequently returns HTTP 401.

Initial normal Stop and fallback Stop time out before extraction or runtime/startup changes.
A fresh drain check confirms zero queued/running analyses and zero Graphile jobs; the owned drained
Worker is killed to reach offline, then native installation and normal startup pass. No live claim
is unlocked. The first failure is retained separately from successful rollout. Graceful panel Stop
is not established by this capture; recheck drain before any future escalation and wait for new work.

The public two-job burst finishes frey-ui/KerjaLog with strict schema 2.0.0 limited reports and
identical direct/proxied readback. frey-ui takes 167.72 seconds execution, KerjaLog 121.03 seconds;
queue wait extends the second completion to 296.36 seconds. Sampled panel memory reaches
169.20 MiB and database clients seven, including observer/overlapping backup overhead. Three
retained reports remain unchanged; both origins pass quick/OpenAPI/missing-analysis checks. Final
API clients/idle transactions are zero and the queue is empty. These host samples do not establish
cgroup peaks or arbitrary capacity. The 1,181 ms deployed initialization event proves startup;
the dashboard offers no explicit suspension/resume transition evidence.

An operator run of the existing backup maintenance procedure restores four reports with seven
matching table fingerprints and strict/API readbacks. It captures a fifth active analysis/queue row
but never starts the copied queue. The user-only encrypted archive expires October 5 at 21:44:50
Jakarta; all owned verification resources and plaintext are removed. One naturally expired archive
and its dedicated key are deleted, while shared keys/unexpired archives are preserved. This manual
execution is marked `scheduled: false`. The existing 12-hour heartbeat and independently verified
first scheduled refresh remain unchanged. Scheduler-fired expired deletion was still unobserved
at that capture; the October 5 scheduler record verified above closes that evidence gap.

Aiven rejects the submitted Free-price fork with “Forking to a free plan is not allowed.” The form
is cancelled and the project still contains only its original running Free PostgreSQL service.
The latest managed backup is October 4 07:58:10 UTC. The displayed Free fork route is unavailable;
guaranteed Free retention and an eligible zero-cost managed restore destination remain unresolved.
No paid plan/card or new service is activated.

The [rollout evidence](implementation/release-evidence/2026-10-04-capacity-rollout.json),
[capacity runbook](implementation/worker-capacity.md) and [backup policy](implementation/preview-backups.md)
retain the runtime revision, artifacts, failure/rollout sequence, scoped observations and teardown.
Historical prepublication captures remain unchanged. This follow-through updates operational
status and maintenance guidance; accepted requirements, architecture decisions, contracts,
scoring, design and tokens are unchanged. The full database-backed local gate and exact-head CI
already pass for the implementation; this documentation PR must pass its own CI/review before merge.

Next session: resolve [PR #47](https://github.com/BlizzardBlast/StackLens/pull/47), current main and actual Vercel revisions without
assuming that the captured runtime SHA remains current. The Worker needs no rebuild for a
documentation-only merge; preserve its independently verified module hashes. Check the next
applicable heartbeat record for naturally expired deletion, keeping shared keys until no archive
uses them. Continue actual Function suspension, general capacity/headroom, eligible managed
restore/retention and replacement-compute/workstation-loss recovery. Device/spoken acceptance
remains user-deferred. Do not extend expiry, delete unexpired archives or activate a paid plan.
This complete handover needs no post-merge SHA placeholder.

The following sections retain their original capture/publication state.

### October 4 Worker capacity and stream-memory milestone

PR #45 is merged; the clean local/remote baseline is `378fd8a`. The new branch extends the existing
operator soak with bounded serial, burst and sustained schedules, durable queue/execution timing,
database counts and source-free resource profiles. The process uses the existing compiled Worker
task-list seam, provider adapters and deterministic orchestration. Synthetic fixtures lazily stream
eight 12 MiB npm packuments per job. Unknown fixture targets fail; normal tests use small responses.

The shared response reader now iterates instead of building a recursive promise chain and releases
failed/oversized streams. UTF-8 decoding, byte limits, full npm metadata, provider validation and
report/scoring behavior are preserved. In the paired six-job synthetic burst, container peak is
202.64 MiB before and 192.30 MiB after; process maximum RSS is 155.52/146.91 MiB. All outcome hashes
match. Six jobs at concurrency two and a twelve-job sustained window at concurrency one also finish
with equivalent reports and zero limit/OOM events. Two-worker per-job execution is slower on
0.25 CPU, so the preview's existing concurrency one is retained. Measurements include file cache,
observer overhead and startup; they do not establish arbitrary workload capacity.

Four live frey-ui/KerjaLog burst jobs also finish with strict limited reports at their recorded
immutable revisions: 219.85 MiB container peak, 183.26 MiB process maximum RSS, zero limit/OOM events
and clean exits. Execution takes 71.56–98.59 seconds; queue wait extends the last completion to
323.89 seconds. frey-ui preserves three oversized-npm failures and 24 limitations; KerjaLog has five
limitations and no provider failures. Repeated per-repository outcome hashes match. All five runs
remove their own Worker/database/private environment, and the owned local PostgreSQL container and
its anonymous volume are removed after verification. No production queue or deployment changes.

The latest database-backed `pnpm check` passes native/compiled smoke, types, 16 operator checks,
deployment checks, all 22 Turbo tasks, 18 browser cases, lint and formatting. An uncached serial graph passes
independently before the original gate; the follow-through reuses its 22 verified test tasks.
Four stream regressions and five capacity checks are new. See the
[runbook](implementation/worker-capacity.md) and its source-bound evidence for live results,
resource scopes and owned teardown. Documentation-impact updates provider/operator/contributor
guidance, README, architecture implementation notes and journey. Accepted requirements, architecture
decisions, contracts, scoring, design and tokens are unchanged.

The original captures precede publication and retain their uncommitted/undeployed status. PR #46
publishes the reviewed implementation and documentation; verify its final CI/review and merge state,
then resolve current main and actual deployed revisions independently. Review resolves CR-P2-001 (measurement failures
were conflated with failed resource cleanup) and CR-P3-001 (observation deadline wording). Two
regressions verify continued teardown and separate safe failure lists. A fresh two-job serial run
has identical synthetic outcomes, empty observation/cleanup failures, clean exit and zero limit/OOM
events. Its 193.89 MiB container peak and 150.79 MiB process maximum RSS are separate from the five
original captures. The owned local PostgreSQL container/volume and private files are removed.

The [follow-through evidence](implementation/release-evidence/2026-10-04-capacity-follow-through.json)
also records the completed first scheduled backup: seven matching table hashes, three strict/API
readbacks, independently matched archive/operator hashes, complete owned teardown and expiry
October 5 at 20:21:55 Jakarta. No archive is expired at that run, so scheduled expired deletion is
still unexercised. Protected settings, archives and shared keys remain outside Git.

The API dashboard is Ready/Current in Production at `378fd8a`. Six fresh direct/proxied read and
quick checks pass; a deployed successful initialization event takes 1,105 ms. This is startup
evidence, not actual platform suspension/resume. Aiven's latest managed snapshot is October 4 at
07:58:10 UTC, meeting freshness. Four visible snapshots and a Free fork form do not prove guaranteed
retention or restoration: the current form conflicts with official Free eligibility and is closed
without submission. Actual Function suspension, general hosted capacity, Free managed eligibility/
retention/restore, workstation/compute-loss recovery and user-deferred device/spoken acceptance
remain open. This milestone creates no new automation or hosting resource.

### PR #46 publication and rollout handover

The user authorizes publication, merge after CI/review, and deployment to the existing preview.
Keep Worker concurrency one and preserve the private runtime configuration. Exact-head CI and
review must pass before merging; do not substitute the earlier local captures for branch CI.
After merge, build/package the reviewed Worker revision, drain durable queued/running work before
planned Stop/install/Start, verify the native installer hash and deployed provider module, and
remove/revoke temporary deployment access. Verify both Vercel projects at the merged revision.

Then submit a bounded two-job hosted burst through the public REST contract, validate both terminal
reports and retain safe queue/execution timings, provider limitations, sampled panel memory and
database clients. Preserve the previous Worker package for rollback. Hosting samples do not prove
cgroup peaks or arbitrary capacity. Resolve current PR #46/main state and actual hosting artifacts
in the next session; this complete handover intentionally needs no post-merge SHA edit.

Continue the remaining release gates independently: actual Function suspension/resume, guaranteed
Free managed-backup retention/restore eligibility, continuing offsite refresh/deletion policy,
workstation/compute-loss recovery and the user-deferred device/spoken acceptance. Do not extend
archive expiry, delete unexpired archives, change runtime policy or activate a paid plan to make
an operational check pass.

The following sections retain their original capture/publication state.

### October 4 independent database recovery completed

PR #44 is merged. The [independent rehearsal](implementation/independent-preview-recovery.md)
restores the protected logical archive into owned Neon Free PostgreSQL 18 without a card/paid plan.
Expiry cleanup leaves two strict reports; both read back unchanged through direct/proxied public
routes. Fresh frey-ui/KerjaLog jobs finish there in 149,718/113,726 ms, with explicit limitations.
The original executor is offline before target startup; no live-source claim is unlocked.
The copied live queue is empty. Separate-cluster synthetic tests cover copied active/queued/outbox
replay after actual original executor exit, historical preservation and expiry cleanup.

After target drain/offline, the existing Worker returns to Aiven. Two initial rollback deployments
reach Ready but fail startup. Protected settings pass locally; exact input/save checks and a rebuild
with latest Vercel Project Settings and no build cache restore public access. The initial cause is
unconfirmed and the interruption is retained. Successful API deployment `4FdiXkS17osUsMnUJYb1vTosvLux`
and web `FfVmtM3tFrS52jwSuKCBahbiRWoK` are independently Ready at captured main `3747cb9`.
Original report hashes, target-only 404s, quick routes and fresh Aiven KerjaLog delivery pass;
final API clients/idle transactions are zero. No runtime policy or Worker artifact changes.

The target database, limited role and Neon project are removed after identity/drain checks.
Five temporary target/Worker configuration files, both owned local containers and their two volumes
are removed; transient plaintext is empty. Original protected Aiven owner/API settings survive.
A fresh dedicated encrypted archive restores all three current reports with seven matching hashes
and strict/API readbacks; it expires October 5 at 13:03:00 Jakarta. Archive/key are user-only outside
Git. Older unexpired archives remain finite; preserve shared keys until no archive uses them.
The active 12-hour backup heartbeat's first scheduled execution remains unverified.

The operator fingerprint fixes provider-dependent ordering/timezone using `C` and UTC, with an
explicit algorithm and real C/numeric-ICU regression. The initial legacy restore comparison uses
the surviving source to explain the migration hash difference; historical evidence is unchanged.
The full database-backed gate passes 11 operator checks, 22 Turbo tasks (560 Vitest/ten token tests),
18 browser cases, native/compiled smoke, types, lint and format. Two existing parallel five-second
persistence timeouts are retained; the uncached serial graph passes without weaker assertions.
See [safe evidence](implementation/release-evidence/2026-10-04-independent-recovery.json).

Documentation impact includes ADR-0020, architecture, contributor/operator guidance, README,
backup/hosting status and this complete handover. Requirements, contracts, scoring, product UI and
tokens are unchanged. Resolve PR #45, its final CI/review state and current main before continuing;
deployments after merge must be verified independently. No post-merge SHA placeholder is needed.
Next work is actual Function suspension, meaningful capacity/headroom, managed Free restore/retention
and scheduled backup execution. Workstation/compute-loss recovery is not established; device/spoken
screen-reader acceptance remains explicitly user-deferred. Do not invent another analyzer feature.

The following sections retain their original capture/publication state.

### October 4 restricted public API activated

PR #43 merged after exact-head CI `37166523756`, passing database tests, compiled smoke and all
18 browser cases. Web and API are independently Ready at main `515576a`; the API has the paired
restricted login and Worker-managed startup mode. Its deployed initialization event takes 1,165 ms.
The live six-client role rejects the seventh client with `53300` while the owner stays usable.
No unrelated sessions were terminated, and the Worker login/artifact were unchanged.

Direct and same-origin quick/polling checks pass. Fresh `frey-ui` and `KerjaLog` jobs complete with
contract-valid schema 2.0.0 reports and explicit limitations. Across 89 requests and 1,646 samples,
peak total clients are seven and restricted clients one; final API clients/idle transactions
are zero, including a separate same-role inspection. Three sampled old immutable URLs require
Vercel SSO under existing Standard Protection. Authenticated owner-configured rollback deployments
remain outside the restricted public guard; exact autoscaling/workload capacity is not proved.
See the [runbook](implementation/restricted-preview-api.md) and
[hosted capture](implementation/release-evidence/2026-10-04-restricted-api.json).

The eight-report encrypted backup is verified through October 5 at 07:24:01 Jakarta. Its protected
owner configuration and restricted API configuration remain outside Git. The backup heartbeat is
active every 12 hours; first scheduled execution remains unverified. Independent public recovery
needs user sign-in to Neon Free in Chrome. No archive was sent and no independent destination was
activated. Actual Function suspension, managed Free restore/retention, general capacity and
user-deferred device/spoken acceptance remain open. Resolve this evidence milestone and current
main before continuing; preserve the source-bound captures rather than inserting a post-merge SHA.
The two owned local PostgreSQL containers and their two anonymous volumes are removed. Ports
55432/55435 have no listener, and the transient private directory is empty. The finite encrypted
archives, keys and persistent protected settings remain outside Git for backup maintenance.
Documentation links (116), evidence JSON/privacy-pattern validation, lint and formatting pass.
PR #44 contains this complete operational handover and source-bound evidence. Resolve its status
and current main next; no post-merge documentation placeholder is required.

The following sections retain their original capture/publication state.

### October 4 restricted API follow-through

PR #42 merged after exact-head CI `37165057022` and final read-only review with no unresolved threads.
Both Vercel Production settings now track `main`; web and API are independently Ready at `5a5b1d3`.
The current main at capture is `5a5b1d3ff5f53fe3861572cfc904342a4f7a47fa`; resolve it again after
the next milestone merge. The restricted API startup path is prepared on the current branch.
PR #43, ADR-0019 and [its runbook](implementation/restricted-preview-api.md) describe Worker-owned schema
bootstrap/delivery, six API connections and minimal read/insert grants. An isolated test passes
denied DDL/Graphile access, durable pending work, later Worker delivery, sanitized 503 on role
saturation and recovery after release. No constrained hosted login or activation is claimed yet.

The full database-backed gate passes with seven operator checks and 18 browser cases, using the
preceding uncached serial pass of all 22 Turbo tasks (560 Vitest tests and ten token tests).
The existing parallel persistence timeout recurred; no assertions/timeouts were changed. Final
privilege-review corrections pass the focused integration check, lint and formatting again.
The [main API capture](implementation/release-evidence/2026-10-04-main-api.json) records three
deployed successful initialization events (1.31–1.58 seconds) matching PR #42's main revision.
This does not establish platform suspension/resume. Resolve PR #43 and current main after merging;
the runbook defines paired login/mode activation and rollback without a post-merge SHA placeholder.

The backup heartbeat `stacklens-encrypted-preview-backups` is active every 12 hours in this chat.
Its private database configuration is protected outside Git; the verified eight-report archive
expires October 5 at 07:24 Jakarta. First scheduled execution and public replacement routing remain
unverified. The historical publication/capture sections below retain their original state.

### October 4 publication and operational follow-through

The user authorized review, publication, CI, and subsequent deployment/operational follow-through.
[PR #42](https://github.com/BlizzardBlast/StackLens/pull/42) contains this milestone. Resolve and verify
current remote `main` after merge; the older verified main below is the capture baseline.
Final review tightened encrypted archive/key reads: reject oversized regular files before allocation
and enforce the bound during streaming. Cleanup in API lifecycle and recovery rehearsals now attempts
every owned resource and records failures rather than claiming success after partial cleanup.
The separate-cluster synthetic replay and three-instance API lifecycle checks pass again with empty
cleanup failures. October 3 evidence remains bound to its original source hashes and capture scope.

A fresh parallel gate encountered the existing database-test timeouts. The complete uncached serial
test graph passed all 22 tasks without changing assertions or timeouts; the full database-backed
gate passes using that verified cache, six operator checks, five deployment checks and 18 browser
cases, plus native/compiled smoke, types, lint and format. Current official Aiven documentation confirms Free has no connection pooling.
A constrained API login requires separate schema-owner migration validation before activation.
CI run `37164668619` passed the synthetic and browser suites but failed a Linux-only absolute-import
warning in the container fixture. The fixture now mounts beside the compiled runtime and uses a
relative import; its three-instance lifecycle rehearsal and lint pass again.

The October 4 refreshed encrypted archive restores all eight currently retained reports with seven
matching table fingerprints and eight API readbacks on a separate local cluster. The verified file
is `%USERPROFILE%\.stacklens\backups\preview-20261004-verified.slbackup` with key
`%USERPROFILE%\.stacklens\keys\preview-20261004.key`; both have restricted Windows permissions.
It expires October 5 at 07:24:01 Jakarta. The first attempt created an archive but failed before a
verification record; that candidate remains separately labeled and is not the verified fallback.
No hosted queue or public routing changed during restoration. Automated refresh/deletion is still
the next operational step. October 3's archive and its expiry remain historical below.
Resolve current `main` HEAD and this milestone PR before continuing; do not assume a future squash SHA.
The sections below describe the October 3 captures and their original publication state.

### October 3 preview operational hardening

PR #41 is merged. Its former head `8d0993356e4507678b111d4c45aafabd188186ea` and verified main
have identical tracked files. Chrome confirms Ready web deployment `Gq4WZy2H43i3Uq3jpubw8HEgsU2y`
and API deployment `8aAjQ1Cee1E3Zn4FFMbHPsYQZajk` still use that old head and track
`codex/mvp-release-readiness`. Resolve fresh remote refs and actual deployed revisions before
promotion; no branch setting, public deployment or Worker upload was changed in this pass.

The [new runbook](implementation/preview-operational-hardening.md) and
[source-bound evidence](implementation/release-evidence/2026-10-03-preview-hardening.json) cover
three fresh local API instances, 24 concurrent lookups, process freeze/resume, a bounded hosted
burst with zero final API clients, and eight serial live-provider jobs in the panel's Linux image
at 256 MiB/0.25 CPU/concurrency one. All eight reports are contract-valid and limited; cgroup peak
is 249.68 MiB, with zero memory-limit/OOM events and clean exit. An earlier incomplete attempt is
retained separately; its failure cause is unknown. General workload capacity remains open.

The API emits a source-free successful initialization event containing only event name, validated
revision or null, and composition milliseconds. It is prepared locally, with privacy/failure tests;
actual Vercel startup/suspension still needs a deployment capture. Accepted analyzer/report/scoring
behavior is unchanged. `pnpm test:operations` is included in the root test gate; live operations
remain opt-in. ADR-0018 explains archives and the blocked connection-budget activation.

The hosted database has 20 maximum connections, three superuser-reserved slots and an unlimited
shared-role setting. A disposable three-client role budget passed local saturation/recovery tests.
A hosted limit of 14 is prepared, but Aiven rejected applying it with SQLSTATE `42501`. The user menu
exposes only credential reset. No sessions
were terminated or privileges expanded. Do not call that guard active. A restricted API login or
broker needs startup/migration privilege and host review; shared-role limits would not reserve
exclusive Worker slots and PostgreSQL documents approximate enforcement.

An encrypted logical backup of 11 stored reports is retained outside the checkout with a separate
protected local key. Its restore window expires **October 4, 20:44:31 Jakarta**. All seven table
hashes and strict report reads match on a separate local PostgreSQL server. The synthetic separate-
cluster rehearsal also restores/replays copied running, queued and pending outbox work after actual
original-executor exit, removes an expired terminal record before API readback and preserves
historical report JSON/source claims. No hosted queue was unlocked. See the runbook for the private
archive/key locations, authenticated expiry/deletion and owned-target cleanup. Refresh or expire the
archive; no recurring schedule is active. Local fallback depends on this workstation surviving.

Aiven Chrome inspection now lists its latest completed managed snapshot at October 3 07:58:06 UTC,
with three visible snapshots totalling 103 MB. Free-plan retention, provider-managed restore,
replacement public hosting/routing and automated freshness remain open. Physical-device and spoken
screen-reader checks remain user-deferred. No card, paid service, commit or push was added.

Next session: review/publish this prepared branch through normal CI when requested, resolve current
main and Vercel source revisions, decide production-branch promotion, and capture deployed startup
events. Resolve supported aggregate connection isolation before treating this preview as broadly
available. Rehearse actual public replacement routing before closing disaster recovery. Earlier
sections below describe their original capture state and do not override this current handover.

Final verification: database-backed `pnpm check` passes native/compiled smoke, strict types, five
deployment and five operator checks, 18 browser cases, lint and formatting. Its 22 Turbo test-graph
tasks reuse the preceding uncached serial pass of 559 Vitest tests. Initial parallel timeout logs
are retained, with unchanged assertions/timeouts. Documentation and relative-link review pass.
Owned PostgreSQL containers and their three anonymous database volumes are removed, including the
11-report restored copy. Ports 55432/55434/55435 have no listener. The private operator directory is
empty; the encrypted archive and protected dedicated key are retained outside Git for their stated
restore window. No plaintext dump or copied database credential remains in that directory.

### October 3 scoped PR review corrections

PR #41 now distinguishes actual retention deletion from a missing terminal report. The application
performs one analysis reread only when the report is missing: an absent row produces `404`, while a
surviving completed record produces sanitized `503` and can recover on a later request. Existing
report readers, public schemas and Query cancellation/polling behavior are preserved.

Submission waits for the atomic analysis/outbox commit, then starts unawaited best-effort dispatch.
The continuous Worker recovers pending deliveries and expired leases; the Vercel API has no pump.
ADR-0016 and current hosting guidance correct their earlier awaited-dispatch claim. The quality
workflow now runs the existing compiled native-entry/API/Worker smoke after build with PostgreSQL 18.
See the [API contract](implementation/repository-api.md) and
[verification guidance](../CONTRIBUTING.md#compiled-runtime-verification).

At that review, PR #41 was draft and unmerged; publication evidence is recorded in the PR. It has
since merged, as recorded in the current handover above. This scoped correction did
not extend the dated runtime measurements below or close capacity, Function lifecycle, full disaster
recovery or manual device/spoken-output gates. Narrator idle repetition remains P3 and user-deferred.

### Hosting history and current resources

The user requested Vercel project names `stacklens` (web) and `stacklens-api` (API). Both are renamed
in place with their original project IDs. Current addresses are
[StackLens](https://stacklens-web.vercel.app) and [API](https://stacklens-api.vercel.app).
Vercel rejected `stacklens.vercel.app` as belonging to another team. Both original auto-assigned
addresses remain compatibility aliases. Web Production Config now uses the named API origin;
publication must rebuild routing and verify the actual current HEAD. See the
[naming record](implementation/release-evidence/2026-10-02-project-naming.json) and PR #41 for the
subsequent deployment/CI results. Project renaming does not establish release readiness.

The user requires free hosting without a payment card. Aiven project `stacklens-preview` and
PostgreSQL Free service `stacklens-preview-pg` are created in DigitalOcean `blr` (Asia Pacific).
Live isolated verification confirmed PostgreSQL 18.6, verified TLS, unrelated-CA rejection,
StackLens/Graphile migrations, quick analysis, durable enqueue and provider-free Worker startup/
shutdown. The isolated database was removed. The preview database retains the remote validation
analyses and reports under the configured finite retention policy.
See [managed hosting](implementation/managed-hosting.md) and the
[new evidence](implementation/release-evidence/2026-10-01-managed-hosting.json).

Shared persistence now accepts verified CA and finite pool/connection settings. Executable API
and Worker parse `STACKLENS_DATABASE_SSL_CA` and `STACKLENS_DATABASE_POOL_MAX`; the intended
managed settings are portable API max three, Vercel API max one per instance and Worker max five/
concurrency one. Container health checks use the same CA and a separate one-connection pool.
URL SSL overrides and malformed options fail
without exposing values. Analyzer policy, contracts and requirements behavior are unchanged.

Northflank's created `stacklens-preview` project is empty. Its actual Sandbox service form requires
a card, contradicting the earlier blog-based recommendation, and the user explicitly rejected
card verification. Do not retry card setup or claim Northflank satisfies the constraint. Railway
has a private `stacklens-preview` project and configured offline API/Worker services after the user
completed GitHub sign-in. Its CLI remains unauthenticated; no source, backend secrets, public
domain or deployment was uploaded. Trial allocation is thirty days/$5; startup memory observations
of 159.2/167.8 MiB imply roughly $3/month RAM cost at the advertised rate, above recurring $1 credit.
It is only an inactive trial candidate. ClawCloud's main and regional browser endpoints did not
resolve. The user completed Silly Development signup and a Free `stacklens-worker-preview`
server (`60761d98`) was created without a card. Node 24 and `start-worker.js` are configured;
reviewed code and Aiven runtime credentials were uploaded after explicit approval, and the Worker
activated. Remote TLS/migrations passed. The initial anonymous run completed frey-ui with
48 limitations and failed KerjaLog at GitHub's metadata rate limit. After authorization and
user-completed GitHub verification, a new public-only token with zero account/private-repository
permissions was created and installed in the private Worker runtime file. It expires 2026-10-31.
The authenticated rerun completed frey-ui in 158.1 seconds with 24 limitations and three bounded
npm response-size failures; KerjaLog completed in 127.0 seconds with five static-evidence limitations
and no provider failures. Both reports use schema 2.0.0. Sampled memory reached 249.41 MiB of 256 MiB,
and the Worker stayed running. Capacity headroom is tight; this is not proof of arbitrary workload fit.
Broader CLI credentials must not be reused. The temporary upload key was revoked again (`401` and
an empty dashboard list), and local private copies were removed. The expiring GitHub runtime token
remains on the approved Worker host.
A 256 MiB/no-swap/0.25 CPU local Worker previously completed frey-ui with limitations;
KerjaLog failed, and the anonymous GitHub allowance was observed exhausted afterward. Failure
classification and peak memory were not retained; do not present that experiment as full resource
acceptance. No paid upgrade or purchase occurred.

`scripts/prepare-silly-worker.mjs` packages the Linux production image for the panel's automatic
npm/ts-node startup without reinstalling workspace dependencies. The adapted 16 MB archive passed
Node 24.17.0 startup, certificate-verified Aiven health, StackLens/Graphile migrations and continued
running state at 256 MiB/0.25 CPU. The peak reached the memory cap without OOM; full analysis fit is
still open. Temporary local containers, databases and private runtime files were removed. The
adapter imports the existing Worker entrypoint and keeps secrets in a separate private runtime file.
The panel's unpacker converted pnpm links into files, causing a missing persistence package.
The one-shot `deploy/silly/install.js` verified the archive SHA-256 and used native Linux `tar`,
preserving links. It was removed, with the normal main file restored and arguments cleared.
Read [managed hosting](implementation/managed-hosting.md) before repeating that deployment.
Remote stop/start and unchanged terminal report readback passed after retrying the start request;
the first immediate start attempt exceeded its deadline. This earlier check did not exercise an
active job; the October 2 restart result below records delayed recovery.
The temporary Silly upload key was revoked (`401` on reuse and no keys in the dashboard). Local
upload credentials were removed; the approved private runtime file remains on the Worker host.

The Dockerfile's final selector accepts `STACKLENS_RUNTIME=api` or `worker` as a non-secret build
argument while preserving explicit Compose targets. Both Linux images rebuilt successfully and
passed non-root/read-only health against an isolated Aiven database, which was removed along with
the temporary containers. `.railwayignore` protects local environment files and diagnostic assets
if a trial upload is later authorized.

After explicit approval, commit `7ce34f0` was published in draft
[PR #41](https://github.com/BlizzardBlast/StackLens/pull/41). Render's approved Free submission
requested card verification; no card or service was added. The separate Vercel API destination
was explicitly approved. Only the Aiven URL and CA are saved as API Production Secret values;
the provider token remains Worker-only. Earlier configuration/native startup failures are preserved
in the [API record](implementation/release-evidence/2026-10-02-api-target.json).

Runtime revision `75bf5a2f37d32b98925dd922eb0c6410df3f55fc` passed
[quality run 36947487085](https://github.com/BlizzardBlast/StackLens/actions/runs/36947487085).
Its native entrypoint exports the ready, unbound Fastify server and lets Vercel bind HTTP. The
539-test database-backed gate includes fresh native-entry and compiled API/Worker smoke. API
deployment `Fd6qZs1W8XvuG44FbqZ6upyuT4jW` and separate root/Vite web deployment
`BxtVh6H5U5DGpdkAYusTn4k1V3Vp` were the first verified public builds. The dated acceptance record
preserves their source revisions; resolve current PR HEAD and deployment IDs for later work.
Both Hobby projects track the release branch,
build only Production. API PR/commit comments are disabled; the web deployment posted a Vercel bot
comment, so comment suppression is not established for the web project. That platform label is a personal preview.
Web Config values contain Corepack and the public API origin only; no backend secret is transferred.

The [public validation](implementation/public-preview-validation.md) and
[source-free record](implementation/release-evidence/2026-10-02-public-preview.json) cover direct
API and web-proxy HTTP errors/cache/transient quick reports, both repository reports, actual web
forms, native file replacement, evidence focus return, deep-link reload, terminal polling stop and
320px Chromium emulation. Reports retain acquisition/static limitations; analyzed code is never
installed or executed. First/warm observations do not prove a forced cold start.

The active KerjaLog panel restart exposed delayed recovery: durable submission at 00:54:08 UTC,
completion at 05:04:53 UTC, 15,044,783 ms later. The old Worker exited and a new Worker connected,
but the public analysis stayed running until delayed recovery. No manual unlock ran; the temporary
recovery editor was not saved. A panel sample of 257.36 MiB exceeds the displayed 256 MiB cap;
it is not a cgroup peak or an OOM-absence proof. Immediate recovery, capacity, remote expiry/restore,
Function suspension/aggregate connections and real assistive-technology/device acceptance remain open.
Drain before planned restart; unlock only a confirmed dead Worker through Graphile's supported
administrative function. Do not add a public recovery endpoint or unlock live workers.

### October 2 Worker recovery follow-up

The follow-up was validated on a dirty base `405b42046108367a374f73c923b1c60b397d28d6` in the existing
checkout and is published through draft PR #41. It adds per-job cancellation, serialized npm acquisition, awaited Graphile queue writes,
shared shutdown completion and confirmed-dead-owner recovery. Graphile 0.18 locks by its `pool-...`
ID; an individual `worker-...` logger ID is insufficient. The Silly launcher replaces its ts-node
child with native Node and a 96 MiB old-space cap. The parent remains. An 80 MiB experiment stopped
before completion and was rejected. The final Linux two-repository run peaked at 244.25 MiB under
256 MiB/no swap/0.25 CPU, with zero memory-limit/OOM events. This does not prove sustained/general fit.

The compiled Worker patch is activated on the existing approved host; no runtime credentials were
changed. During capture Vercel web/API used `405b420`. A hosted active-job Stop/offline/Start released the
exact old queue owner in 22,379 ms, queued the interrupted attempt without a report, and resumed
the same KerjaLog ID on attempt two under a different pool. It finished in 192,798 ms with five
limitations and no provider failures. No administrative unlock ran. Local integration also verifies
actual child-process death before targeted recovery while preserving a second live owner's lock.

Remote Worker expiry cleanup removed an owned synthetic terminal analysis/report/delivery within
6,229 ms and public lookup returned 404. Expired queued/running and legacy null-expiry fixtures were
preserved, then all owned fixtures were removed. Fresh public submissions receive 24-hour expiry.
A consistent private PostgreSQL 18 backup restored into a separate owned Aiven database with
matching application/Graphile table hashes. Eight historical reports passed strict repository/API
readback without rewriting. The copied active queue was not executed. The database/dump were
removed; this proves a restore rehearsal, not scheduled backup policy or disaster queue replay.

The database-backed `pnpm check` passes, including 27 Worker tests. API startup tests now await
startup completion before resetting modules/environment; no API production behavior changed.
See [ADR-0017](adr/0017-worker-interruption-and-recovery.md), the
[runbook](implementation/worker-recovery.md) and exact
[source/evidence record](implementation/release-evidence/2026-10-02-worker-recovery.json).
The user explicitly left real phone/screen-reader acceptance open. Another browser engine,
Function suspension/aggregate connections, sustained capacity and operational backup policy remain
release gates. The public-only provider token still expires 2026-10-31.
The temporary upload key was revoked (401 on reuse, no keys in the dashboard); local private files,
owned rehearsal databases and the disposable PostgreSQL container were removed. Final review and
documentation/credential/link checks pass for this bounded follow-up.

Next session: resolve current PR #41 HEAD and `main`, inspect its diff and check publication CI plus
both actual Vercel deployment revisions. Match the Worker files to the published source hashes;
the dirty capture remains the timing basis rather than claiming it observed a later commit.
Documentation pushes can rebuild both targets. PR #41 was draft during those captures and has since merged.
Preserve the earlier dated runtime evidence rather than rewriting it as a later pass.

### October 3 operational follow-up

The [operational record](implementation/operational-preview-validation.md) adds 18 synthetic
Chromium/Firefox/WebKit acceptance checks at 1280px/320px, now included in `pnpm check` and CI.
Both report readers, native file replacement, focus, reflow and polling recovery are covered.
Six serial hosted jobs completed with contract-valid limited reports in 736,005 ms. Only two panel
resource samples were captured; no new cgroup peak or OOM history is claimed. A four-report logical
restore matched all recorded hashes, with the private dump and owned target removed afterward.
The [backup policy](implementation/preview-backups.md) records the existing daily encrypted schedule
and Free-plan fork limitation; no paid or new secret destination was activated.

The first API burst peaked at ten clients including its observer, under the twenty-connection limit.
Five baseline clients became six after idle. The labeled follow-up on `d80ab03` found six API clients
remaining after the final idle interval despite lifecycle attachment. That commit's CI and both
deployment checks passed. The request-bound adapter now retires clients with `maxUses: 1` and uses
`stacklens-api-vercel-single-use` to distinguish its policy. On `beaac25`, CI and both deployments
passed. Seventeen lookups at concurrency two peaked at eight total clients; both idle intervals
ended with zero new-policy API clients and the aggregate returned to its five-client baseline.
Lookup median was 455 ms and maximum 4,064 ms. Twelve direct/proxied checks passed; a fresh frey-ui
submission returned 202 in 649 ms and a valid limited report in 143,683 ms. Preserve the earlier
failed samples and the successful capture's exact runtime revision. Actual cold-start/suspension,
autoscaling-wide ceilings, general capacity, no-card disaster recovery and manual acceptance stay
open. Preserve each observation's original source revision. Resolve PR #41's current HEAD and actual
CI/deployments; it was draft at that capture and has since merged.

### Earlier portable preparation evidence

The user selected Vercel and requested backend preparation. The [web runbook](implementation/vercel-hosting.md)
and [backend runbook](implementation/backend-hosting.md) describe the prepared target: static web on
Vercel with an explicit HTTPS API origin, plus portable API/Worker/PostgreSQL containers and Caddy
TLS routing. `vercel.mjs`, the production Dockerfile and separate production/rehearsal Compose files
were ready for review. At that earlier preparation there was no linked Vercel project, external
host, public origin or deployment; the current API project status is recorded above.
The local root Compose definition remains PostgreSQL-only.

The API assigns configurable anonymous expiry (24 hours by default); Worker maintenance removes
expired terminal analysis/report/delivery state with bounded row locking. Queued/running ownership
and legacy null-expiry records are preserved. Origin and Vercel routes prohibit API caching.
At that preparation, a missing completed report returned 404 even if the analysis survived. The
scoped correction above now rereads once and distinguishes actual deletion from missing-report 503.
Production entrypoints require a database URL. Analyzer v6, quick-manifest v5, both report readers,
schema 2.0.0 and stack-health-v3 remain as recorded in the prior live pass.

The [October 1 evidence](implementation/release-evidence/2026-10-01-hosting.json) records Linux container
builds, actual healthy non-root/read-only execution, queued submissions surviving API restart,
both repositories completing with explicit provider limitations, quick non-persistence, retention
cascade and isolated PostgreSQL restore. KerjaLog's OSV timeout leaves Security unknown; frey-ui
retains the three bounded npm failures. This evidence covers a local container rehearsal, not Vercel
edge behavior or public TLS. Database-backed `pnpm check` passed 511 tests with eighteen of twenty-two
test-graph tasks cached. Final image verification and cleanup are recorded in the evidence file.

At that preparation, activation required a backend host/domain and the intended Vercel account/project, followed by
public preview acceptance, finite off-host backup/log policies and the
[real screen-reader/device checks](implementation/manual-release-validation.md). New branch CI must
run after publication. No commit, push, purchase, provisioning or deployment was performed in that pass.
The initial free-host comparison recorded Vercel Hobby's personal-use boundary
and Oracle Always Free as a candidate for the current containers. No backend provider was selected then.
An Oracle Ampere host requires a fresh ARM64 build/runtime rehearsal; moving the Worker to Vercel
instead requires an explicit architecture decision. The existing local evidence covers neither route.
Resolve and verify the then-current `main` before further work; do not invent a milestone merge SHA.

## Previous handover: local live MVP release validation

> **Prepared:** 2026-09-30\
> **Architecture:** v0.1.15\
> **Milestone:** Local live MVP release validation\
> **Branch:** `codex/mvp-release-readiness`, existing checkout; changes uncommitted\
> **Baseline:** `f51d2b61f4740172558bb4b38087af60af8d791a`, merged PR #40\
> **Traceability:** FR-001–FR-006, FR-010/011/017–023, NFR-005–009, SEC-001–003, GOV-002/007

### Previous live validation details

[Live release evidence](implementation/mvp-release-readiness.md) records KerjaLog and frey-ui through
the real local web/API/PostgreSQL/Worker stack and live providers. Both immutable inputs completed
with limitations before and after the acceptance corrections. Paste/upload, actual GitHub failure,
stable input errors, quick non-persistence, keyboard focus, reduced motion and verified 320px layouts
were checked. The [baseline quality run](https://github.com/BlizzardBlast/StackLens/actions/runs/36728238578)
passed for merged PR #40. Resolve and verify the current `main` HEAD before continuing; these local
changes have no published PR or deployment.

The live pass corrected native quick-mode radio names/descriptions and misleading npm-health
limitations on internal workspace links. `JS-NPM-010@2`, `javascript-production-v6` and
`javascript-rules-v6` identify the correction. Quick-manifest v5, both strict report readers, schema
2.0.0 and stack-health-v3 formulas remain unchanged. Existing reports retain their original values.

frey-ui's actual report preserves three oversized npm responses and, on the v6 rerun, one GitHub
file timeout. It detects OSV advisory GHSA-82fw-gwwq-j7x9 for three package-scoped Vitest declarations;
the report records one distinct advisory and a medium Security band. Unknown categories stay N/A.
Do not reinterpret scores as safety, test results or runtime coverage.

The web jsdom suite now caps isolated workers at two after default concurrency caused three
existing tests to time out. The final database-backed `pnpm check` passed all 501 tests, compiled
runtime smoke, build, typecheck, lint and formatting; the release record distinguishes cached tasks
from fresh execution and records cleanup.
Actual screen-reader, physical-device and production-host verification remain release gates. The
next step is that manual verification and publication/review of this branch when authorized.

## Previous handover: eight-finding remediation

The following snapshot predates PR #40's merge. Its publication/merge claims are historical;
the current handover above supersedes them.

> **Prepared:** 2026-09-30
> **Architecture:** v0.1.15
> **Milestone:** Eight-finding review remediation
> **Publication:** Review PR from `codex/review-findings`; no merge or deployment
> **Branch:** `codex/review-findings`, existing checkout
> **Baseline:** `962146e0352386a15d7ba40ee5eb745a918d4a6d` (`main` and `origin/main`)
> **Traceability:** FR-002/003/005/014/017–023, SCORE-002/003, NFR-006–009, SEC-001/002, GOV-002/007

### Previous handover details

The approved remediation addresses CR-P1-001–004 and CR-P2-001–004. The
[remediation ledger](implementation/review-findings-remediation.md) records each finding,
phase review, regression and final verification. The September 29 gate passed before the user
authorized a review PR on September 30. Verify the current branch, main HEAD, working tree and PR
checks before any later work or merge.

Repository and provider-free quick-manifest compositions use v5 identities. JS-INSPECTION-018 is
version 2 and JS-MIGRATION-014 is version 3. Report schema 2.0.0, strict historical schema 1.0.0
readers and stack-health-v3 formulas are unchanged. Corrected evidence affects newly generated
reports only; there is no migration, historical rescore, backfill, dependency upgrade or deployment
sequence change. Rollback retains schema 2 read support.

npm workspace links require importer and acquired-member identity evidence and never reach external
providers when internal or unresolved. Node discovery uses supported Node conventions; equivalent
migration declarations share one opportunity with combined evidence. API and Worker both default to
Compose port 55432. File generations prevent stale uploads; authoritative 404s stop automatic
refetches. Explicit evidence Close and quick completion/reset restore useful keyboard focus.

Final review of PR #40 found one remaining missing-lockfile case: without a package-manager hint,
a declaration sharing an acquired workspace member name still reached npm/OSV. The PR follow-up
marks this case unresolved without inventing an internal edge. Unrelated names remain external.
Focused regressions and a fresh database-backed `pnpm check` passed, including compiled runtime
smoke. The dedicated follow-up database was removed and Docker restored to its original stopped
state. PR #40 still awaits merge review; no merge or deployment occurred.

[Scoring policy](implementation/scoring.md), [report contract](implementation/analysis-contracts.md),
[report design](design/report-evidence.md) and ADR-0013 remain authoritative. Provider responses and
browser fixtures are synthetic; no analyzed code is executed. Unsupported selectors, external preset
internals and runtime-dependent discovery remain bounded static limitations.

Verification uses the dedicated `stacklens_remediation_20260929` database and restores the original
stopped PostgreSQL service state afterward. The ledger records actual cleanup and check results.
Browser evidence covers emulated desktop/320px layouts, both themes, reduced motion and keyboard/DOM
behavior. It does not claim physical-device or screen-reader testing.

## Historical milestone context

The sections below retain earlier implementation context. Their old versions, test counts and
next-step descriptions are historical; use the current handover and linked review for release state.

## 1. Start here in the next session

Before implementing anything:

1. Confirm `main` contains this handover and is green in GitHub Actions.
2. Read, in order:
   - `docs/requirements.md`;
   - `docs/architecture.md`;
   - `docs/adr/0008-analysis-report-contract-v1.md`;
   - `docs/adr/0009-deterministic-staged-analyzer-core.md`;
   - `docs/adr/0011-deterministic-priority-recommendation-scoring-v1.md`;
   - `docs/adr/0012-scoped-scoring-and-evidence-recovery.md`;
   - `docs/implementation/analysis-contracts.md`;
   - `docs/implementation/analyzer-core.md`;
   - `docs/implementation/repository-analysis.md`;
   - `docs/implementation/repository-jobs.md`;
   - `docs/implementation/repository-web.md`;
   - `docs/implementation/local-development.md`;
   - `docs/implementation/mvp-acceptance.md`;
   - `docs/implementation/rules-javascript.md`;
   - `docs/implementation/scoring.md`;
   - `docs/implementation/quick-manifest-analysis.md`;
   - `docs/implementation/data-sources.md`;
   - `packages/contracts/README.md`;
   - `packages/analyzer-core/README.md`;
   - `packages/analysis-orchestration/README.md`;
   - `packages/persistence/README.md`;
   - `packages/repository-jobs/README.md`;
   - `packages/rules-javascript/README.md`;
   - `packages/scoring/README.md`;
   - `packages/data-sources/README.md`;
   - `apps/api/README.md`;
   - `apps/web/README.md`;
   - `apps/worker/README.md`;
   - `AGENTS.md`;
   - `CONTRIBUTING.md`;
   - `docs/documentation-governance.md`.
3. Work from a feature branch and pull request. Do not implement directly on `main`.
4. Put applicable requirement IDs in the implementation task, tests where practical, commit/PR context, and PR description (**GOV-002**).
5. Append a new entry to `docs/design/journey.md` in every PR (**GOV-007**).
6. Do not change product behavior through implementation alone. If a needed behavior is not covered, update the requirement first or in the same PR (**GOV-003**, **GOV-005**).

## 2. Current implementation state

The repository already has the following accepted foundations:

- canonical product/system requirements;
- architecture v0.1.15;
- Product Design v1;
- generated design-token infrastructure;
- shared UI package;
- Analysis Report Contract v1 in `@stacklens/contracts`;
- deterministic analyzer execution in `@stacklens/analyzer-core`;
- deterministic JavaScript dependency inventory in `@stacklens/rules-javascript`;
- provider-backed npm outdated/deprecation/health analysis in `@stacklens/rules-javascript`;
- provider-backed factual known-vulnerability detection in `@stacklens/rules-javascript`;
- curated dependency-overlap heuristics, framework/tool facts, and static configuration inspection in
  `@stacklens/rules-javascript`;
- framework-independent quick manifest orchestration in `apps/api`;
- bounded npm Registry metadata acquisition in `@stacklens/data-sources`;
- bounded exact-version OSV vulnerability acquisition in `@stacklens/data-sources`;
- bounded immutable public GitHub repository acquisition in `@stacklens/data-sources`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.
- runnable local web/API/worker composition with PostgreSQL 18 via Docker Compose (host port
  `55432`, container port `5432`); root `pnpm dev` automatically prepares the shared workspace
  dependency outputs required by web/API/worker before their watch processes start;

The latest hosted-product slice is the **repository-analysis web flow** in `apps/web`, including a
post-K1 UX refinement from real end-to-end use. The browser remains a replaceable client of the
public Fastify contract: TanStack Query polls durable status, shared contracts validate terminal
reports, and React renders analyzer-owned findings/evidence/limitations/scores without importing
persistence, Worker, or provider internals. Submission and initial-route fetches now have explicit
busy/preparing states, while active analysis renders the real coarse server stages as an accessible
timeline without fake percentage progress.

The analyzer flow is:

```text
normalized context
      ↓
fact rules
      ↓
facts
      ↓
finding rules
      ↓
finding candidates
      ↓
FindingPrioritizer
      ↓
finalized findings
      ↓
recommendation rules
      ↓
recommendations
      ↓
AnalysisScorer
      ↓
scores
      ↓
AnalysisReport
```

The JavaScript/TypeScript rule package now implements **FR-005 dependency inventory**, **FR-006 exact-version outdated detection**, **FR-007 explicit npm deprecation detection**, **FR-008 curated overlap heuristics**, neutral **FR-010 npm Registry health facts**, **FR-011 known-vulnerability detection**, **FR-012 framework/tool detection**, and **FR-013 static configuration detection**.

The API application has the framework-independent quick-manifest service, the K2 synchronous
Fastify/OpenAPI quick-manifest transport, and the J3 repository-analysis transport. The production
React client now consumes both public input modes: repository analysis uses durable polling, while
K3 quick analysis uses synchronous paste/local-file submission and shared report rendering.
`@stacklens/analysis-orchestration` remains the shared long-running public-repository workflow.

The npm Registry, OSV, and public GitHub acquisition adapters are implemented, including explicit
bounded source-coverage state. Static source usage, migration/recommendation policy, production
priority, scoped scoring v2, shared repository orchestration, PostgreSQL analysis/report persistence,
Graphile Worker jobs, both Fastify analysis transports, and both public React input flows are
implemented. Automated acceptance coverage now verifies production-router composition across both
web flows and composed-runtime behavior across both API execution models.

## 3. Non-negotiable boundaries

The next session must preserve these boundaries.

### Requirements remain authoritative

`docs/requirements.md` defines product behavior.

Do not infer new requirements from this handover, README prose, UI mocks, or implementation convenience.

### Analyzer-core stays ecosystem-agnostic

Do not put JavaScript/TypeScript package semantics into `packages/analyzer-core`.

JS/TS-specific normalization and rules belong in `packages/rules-javascript` (**NFR-004**).

### Detection, priority, recommendation, and scoring stay separate

- fact rules emit facts;
- finding rules emit finding candidates without priority;
- `FindingPrioritizer` alone creates priority;
- recommendation rules consume finalized findings;
- `AnalysisScorer` alone owns score policy.

Do not collapse these responsibilities for convenience.

### No hidden I/O in analysis rules

Rules, prioritization, and scoring are synchronous.

npm, OSV, GitHub, filesystem/repository acquisition, and other provider work must happen before the analyzer through explicit adapters.

### Never execute analyzed project code

The analyzer must not run:

- dependency installation;
- lifecycle scripts;
- package scripts;
- builds;
- tests;
- repository config modules;
- Git hooks;
- arbitrary executables.

Static parsing/inspection only (**SEC-001**, **SEC-002**).

### Missing evidence is not negative evidence

Do not infer:

- secure because OSV returned no usable data;
- unused because quick manifest input has no source files;
- unmaintained without supported evidence;
- bad score because evidence was unavailable.

Use limitations and insufficient-evidence score states (**PRD-004**, **SCORE-003**, **NFR-003**).

## 4. Completed milestone: FR-005 dependency inventory

The first JavaScript/TypeScript vertical slice is implemented.

Accepted implementation:

- `@stacklens/contracts` supports optional structured dependency-inventory fact details;
- existing v1 facts without details remain valid and the schema version remains `1.0.0`;
- `@stacklens/rules-javascript` validates and normalizes supported package-manifest dependency groups;
- exact declared specifier strings and dependency-group meaning are preserved;
- equivalent manifest objects normalize deterministically;
- declarations in multiple groups remain separate;
- local `ProjectEvidence` is generated deterministically without fabricated line numbers;
- `JS-DEP-005@1` emits dependency inventory facts only;
- analyzer-core integration produces a contract-valid report with explicit insufficient-evidence scores;
- no provider/network I/O or analyzed-project execution exists in the rule package.

Primary traceability:

`FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, NFR-005, SEC-001, SEC-002`.

## 5. Completed milestone: Quick manifest input/orchestration

The first API-application boundary is implemented in `apps/api`.

Accepted implementation:

- pasted and uploaded manifests use one authoritative service path;
- uploaded quick-analysis files must be named `package.json`;
- empty input, invalid JSON, unsupported uploads, and invalid manifest shapes return stable actionable errors;
- manifest normalization is delegated to `@stacklens/rules-javascript` rather than duplicated;
- the service creates deterministic input fingerprints without persisting raw manifest content;
- dependency project evidence is created before analyzer execution;
- analyzer-core is invoked in-process with caller-supplied analysis identity/time and an injected analyzer definition;
- production quick composition uses manifest-safe dependency inventory, exact-package framework/tool
  detection, curated overlap detection, and the shared deterministic priority/recommendation policy;
- quick-analysis limitations explicitly disclose unavailable source/configuration and external metadata evidence;
- numeric scoring remains insufficient evidence rather than inventing health from manifest-only data;
- no authentication, persistence, provider I/O, repository source analysis, or project execution is introduced;
- ignored manifest fields are not copied into the report, supporting minimum-retention behavior;
- the web report surfaces verified manifest facts before score cards and displays score
  availability without implying a measured manifest-parse percentage.

Primary traceability:

`FR-001, FR-002, FR-004, FR-005, FR-008, FR-012, FR-015, FR-016, FR-017, FR-021, FR-022, SCORE-003, NFR-001, NFR-004, NFR-006, NFR-007, SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007`.

## 6. Completed milestone: npm Registry package metadata adapter

The first external provider boundary is implemented in `packages/data-sources` by PR #13.

Accepted implementation:

- `NpmRegistryAdapter` is the only npm Registry network boundary;
- the adapter uses the fixed `https://registry.npmjs.org/` host and percent-encodes package names;
- full package metadata is requested so versions, dist-tags, explicit per-version deprecation,
  repository metadata, and publication timestamps can be normalized for later rules;
- response bytes and request duration are bounded;
- requested package identity must match the returned package identity;
- dist-tags must reference versions contained in the normalized response;
- malformed deprecation/timestamp/repository/version metadata fails closed instead of being coerced;
- equivalent provider objects normalize deterministically regardless object insertion order;
- successful observations produce contract-valid external source/evidence with retrieval time;
- 404/non-retryable, throttling/server/retryable, network, timeout, invalid JSON/schema, and
  over-limit failures remain typed source failures rather than empty/negative evidence;
- raw provider bodies and low-level network errors are not exposed in public failure messages;
- publisher-controlled repository URLs remain normalized metadata and are not promoted into
  `ExternalEvidence.url`; evidence links are generated only from the fixed npm Registry host;
- PR tests are synthetic and do not depend on live npm availability.

Primary traceability:

`FR-006, FR-007, FR-010, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-002, GOV-006, GOV-007`.

## 7. Completed milestone: OSV vulnerability-data adapter

The second external provider boundary is implemented in `packages/data-sources` by PR #14.

Accepted implementation:

- `OsvVulnerabilityAdapter` is the only OSV network boundary;
- only exact npm semantic versions are accepted for OSV queries;
- ranges/tags/short versions such as `^1.2.3`, `latest`, and `1.2` are rejected before network
  access rather than being treated as installed versions;
- equivalent package/version queries are deduplicated and sorted deterministically;
- OSV `/v1/querybatch` is used for exact package/version matching;
- per-query pagination is followed within a configurable safety bound;
- full advisory-detail lookups are separately bounded; reaching that bound preserves all batch
  matches/evidence and marks the source partial;
- every normalized query records whether its result is complete;
- unique matched advisory IDs are resolved through OSV's fixed `/v1/vulns/{id}` endpoint;
- advisory metadata preserves IDs, modified/published/withdrawn timestamps, aliases/related/upstream
  IDs, top-level/per-package severity records, affected package/version metadata, and validated
  HTTP(S) references;
- severity is source metadata only; the adapter does not derive qualitative severity or score impact;
- `ExternalEvidence` links are generated only from the known `osv.dev/vulnerability/` origin;
- a detail failure preserves the authoritative exact-version batch match and turns the source
  partial rather than erasing evidence;
- pagination/provider/schema failures are typed source failures;
- an empty complete OSV result is not described as proof that a dependency is secure;
- no JavaScript rule performs provider I/O;
- PR tests are synthetic and have no live-network dependency.

The npm and OSV adapters share the bounded response-reader and npm package-name validation helpers.

Primary traceability:

`FR-011, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-002, GOV-006, GOV-007`.

## 8. Completed milestone: Known-vulnerability finding rule

The first provider-backed finding rule is implemented in `packages/rules-javascript` by PR #15.

Accepted implementation:

- `JS-VULN-011@1` is a synchronous factual finding rule;
- the rule consumes source-bound `JavaScriptAnalysisMetadata.osv` metadata containing one exact
  report-level OSV `sourceId` plus a minimal snapshot and has no
  `rules-javascript -> data-sources` dependency;
- OSV/provider I/O remains entirely outside rule evaluation;
- the rule correlates OSV query results only when package name and queried version exactly equal a
  dependency-inventory fact's package name and preserved declared specifier;
- declared ranges/tags without an exact query result remain insufficient evidence;
- duplicate manifest declarations of the same package/version contribute to one finding basis;
- one stable finding candidate is emitted per package/version/advisory match;
- each finding identifies the dependency, advisory reference, stable rule identity, project
  declaration evidence, and OSV external evidence from the exact source bound to the normalized
  snapshot; the source carries retrieval-time provenance;
- source-provided severity is surfaced only as attributed metadata and is not converted into a
  StackLens severity label or score effect;
- batch matches remain factual findings even when optional advisory detail is unavailable;
- withdrawn advisories are not emitted as active known-vulnerability findings;
- incomplete OSV query coverage produces an insufficient-evidence limitation while retaining known
  matches;
- unavailable/mismatched OSV sources, missing snapshots, missing exact-version query results, and
  missing advisory evidence from the exact bound source produce conservative limitations rather
  than clean/secure conclusions;
- complete empty OSV results emit no vulnerability finding and no "secure" fact;
- finding priority, recommendations, and production scoring remain separate/unimplemented;
- focused rule-level and analyzer-core integration tests are synthetic and network-free.

Primary traceability:

`FR-011, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, SEC-002, GOV-002, GOV-006, GOV-007`.

## 9. Completed milestone: npm metadata dependency rules

The npm Registry-backed JavaScript/TypeScript rule slice is implemented in
`packages/rules-javascript` by PR #16.

Accepted implementation:

- `JavaScriptAnalysisMetadata.npmRegistry` carries source-bound normalized npm package snapshots;
- each snapshot is associated with one exact report-level npm Registry `DataSource.id`;
- npm-backed rules require external evidence tied to that exact source/reference;
- rules remain synchronous and add no `rules-javascript -> data-sources` dependency;
- shared deterministic dependency grouping/order/truncation helpers are reused by npm rules and
  FR-011 without changing existing vulnerability rule IDs or behavior;
- `JS-NPM-006@1` implements factual outdated detection for exact Semantic Version declarations;
- the declared exact version and npm `latest` comparison version must both exist as normalized
  registry version records;
- version precedence supports major/minor/patch plus prerelease ordering and ignores build metadata;
- findings explicitly distinguish major, minor, patch, and prerelease-to-release differences;
- ranges/tags/URLs/workspace and other non-exact declarations remain insufficient evidence until a
  resolved exact version source exists;
- `JS-NPM-007@1` emits factual findings only when the exact declared version carries an explicit
  normalized npm deprecation message;
- the optional FR-007 "unmaintained" heuristic is intentionally not implemented because no accepted
  deterministic maintenance threshold/basis exists yet;
- `JS-NPM-010@1` emits neutral package-level npm Registry health facts containing supported
  verifiable metadata such as latest dist-tag, latest publication time, and registry modification
  time;
- FR-010 facts do not label packages healthy/stale/unmaintained and do not create a combined health
  interpretation;
- partial sources may preserve observed positive facts/findings while retaining rule-specific
  partial-failure limitations;
- missing/ambiguous metadata, missing/unavailable bound sources, cross-source evidence, missing
  version records, and unsupported comparison versions produce limitations rather than invented
  conclusions;
- no production priority, recommendation, scoring, repository acquisition, or source-usage policy is
  introduced;
- focused rule-level and analyzer-core integration tests are synthetic and network-free.

Primary traceability:

`FR-006, FR-007, FR-010, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, SEC-002, GOV-002, GOV-006, GOV-007`.

## 10. Completed milestone: overlap plus framework/tool/configuration detection

The static JavaScript/TypeScript project-detection slice is implemented in
`packages/rules-javascript` by PR #17.

Accepted implementation:

- `JS-OVERLAP-008@1` emits medium-confidence heuristic findings only for explicit curated
  package/capability pairs;
- initial overlap rules cover Biome/ESLint, Biome/Prettier, Axios/Ky, Day.js/Moment, and
  Jest/Vitest;
- overlap findings name both packages/capability, preserve all dependency facts/evidence, explain
  why parallel ownership matters, and explicitly avoid claiming that either dependency is
  unnecessary;
- broad category similarity or fuzzy package-name inference does not create overlap findings;
- `JS-TOOL-012@1` emits deterministic manifest-backed facts for a curated exact-package catalog of
  supported frameworks, build tools, test frameworks, linters/formatters, TypeScript,
  state-management libraries, and observability tools;
- duplicate tool declarations produce one tool fact while retaining all declaration evidence;
- `JavaScriptProjectSnapshot` adds optional already-acquired static repository files to the
  normalized manifest without adding filesystem/GitHub acquisition behavior;
- static file paths are canonicalized/validated as relative POSIX paths and deterministic file order
  is preserved;
- `JS-CONFIG-013@1` identifies supported repository configuration files and inspects a bounded
  allowlist of high-level characteristics from strict JSON;
- TypeScript, legacy ESLint JSON, Prettier JSON, and Biome JSON are the first declarative
  configuration families;
- known JS/TS configuration families are identified by path but never imported, executed, or
  evaluated; partial inspection is recorded as a limitation;
- recognized config-family filenames with unsupported formats/extensions, JSONC/comments,
  malformed/unsupported field shapes, and oversized configuration remain detected but limited
  rather than guessed;
- configuration evidence retains path/summary only and does not copy source content into the report;
- the static configuration inspection bound is 512 Ki characters;
- no GitHub acquisition, source-usage analysis, production priority, recommendations, or scoring is
  introduced;
- focused rule-level and analyzer-core integration tests are synthetic and require no live
  repository/network access.

Primary traceability:

`FR-008, FR-012, FR-013, FR-017, FR-021, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-002, GOV-006, GOV-007`.

## 11. Completed milestone: public GitHub repository acquisition

The bounded public GitHub REST acquisition adapter is implemented in
`packages/data-sources` by PR #18.

Accepted implementation:

- `GitHubRepositoryAdapter` accepts only supported HTTPS `github.com/<owner>/<repo>` repository
  URLs, with optional `.git` suffix/trailing slash normalization;
- credentials, query strings, fragments, non-GitHub hosts, non-HTTPS schemes, extra repository path
  segments, invalid refs, and private repositories fail safely;
- repository metadata is fetched from fixed `api.github.com` endpoints with redirects disabled;
- the requested/default ref is resolved to an immutable commit SHA before tree/file acquisition;
- recursive tree enumeration uses the commit tree SHA;
- selected files are fetched by immutable Git blob SHA rather than mutable branch-relative paths;
- the source/evidence reference is generated from the validated repository identity plus immutable
  commit SHA;
- the initial allowlist retrieves only root `package.json` and configuration filename families
  already consumed by FR-013;
- general JS/TS source files remain outside this slice and are deferred to FR-009;
- root `package.json` is prioritized before optional config files under tight budgets;
- defaults enforce 8-second per-request timeout, 8 MiB provider-response bound, 32 selected files,
  512 KiB decoded bytes/file, 2 MiB decoded bytes total, and 40 requests/acquisition;
- recursive-tree truncation remains usable partial evidence and is explicitly disclosed;
- generated/vendor recognized configs, unsafe paths, symlinks, submodules, non-UTF-8/binary files,
  Git LFS pointers, missing root manifests, over-limit files, and file-level provider failures are
  handled conservatively with limitations/partial failures;
- symlinks are never followed, submodules are never traversed, and Git LFS objects are never
  dereferenced;
- selected source/config contents stay only in the transient provider result required to build the
  project snapshot; they are not copied into `DataSource`, `ExternalEvidence`, limitations,
  partial failures, or logs;
- output carries contract-valid repository owner/name/ref/commit identity for reproducibility;
- selected `{path, content}` file output is structurally compatible with
  `JavaScriptStaticProjectFile`; orchestration can normalize/discard the raw manifest and pass
  config files directly into `createJavaScriptProjectSnapshot`;
- the adapter performs no project-code execution, package installation, build/test/script execution,
  or JavaScript rule evaluation;
- private repository auth/write access, worker/job orchestration, FR-009 source-usage conclusions,
  priority/recommendations/scoring, and UI remain outside this PR;
- normal PR tests are synthetic and use no live GitHub dependency.

Primary traceability:

`FR-003, FR-004, FR-013, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-001, NFR-003, NFR-004, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002, GOV-006, GOV-007`.

## 12. Completed milestone: static source usage analysis

PR #19 implements the first bounded **FR-009** repository source-usage slice.

Accepted implementation:

- public GitHub acquisition includes bounded JS/TS/JSX/TSX source files from immutable blob SHAs;
- acquisition exposes complete/partial source coverage without moving parsing into the provider;
- source parsing is behind a StackLens-owned adapter and currently uses `@babel/parser` under
  ADR-0010 because the accepted TypeScript 7 baseline is incompatible with the current
  typescript-estree release line;
- supported syntax includes ESM imports/re-exports, static-string CommonJS `require()`, and
  static-string dynamic `import()`;
- bare subpaths normalize to declared package identity while relative/builtin/protocol references do
  not count as external dependency usage;
- a bounded catalog accounts for deterministic configuration conventions, exact Prettier plugin
  references, and supported package-script executable conventions without executing anything;
- `JS-USAGE-009@1` emits positive static usage facts with project path/line evidence;
- parse failures, non-static dynamic references, and partial/unavailable acquisition suppress
  absence-based conclusions and produce insufficient-evidence limitations;
- `JS-UNNECESSARY-009@1` emits only heuristic potentially-unnecessary findings when supported
  coverage is complete;
- peer-only declarations are not flagged, and development/peer-involved declarations carry lower
  confidence;
- findings explicitly do not claim that dependency removal is safe;
- quick manifest analysis remains source-insufficient;
- no production recommendation, priority, scoring, worker, API transport, or UI behavior is added.

Primary traceability:

`FR-003, FR-009, FR-017, FR-021, DATA-003, DATA-004, DATA-005, DATA-006, NFR-001, NFR-002, NFR-003,
NFR-004, NFR-005, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007`.

## 13. Completed milestone: migration opportunities, recommendations, priority, scoring

PR #20 implements the first production policy slice for **FR-014–FR-021** and
**SCORE-001–SCORE-004**.

Accepted implementation:

- `JS-MIGRATION-014@1` identifies a migration-review opportunity only for an exact declared
  semantic version whose source-bound npm `latest` target crosses a major-version boundary;
- migration findings name current/target state, preserve project/npm evidence, remain
  medium-confidence heuristics, and explicitly do not make migration mandatory;
- `JS-PRIORITY-016@1` is the production JavaScript/TypeScript prioritizer;
- known vulnerabilities and explicit deprecations are high priority; major migrations, exact-version
  outdated findings, and curated overlaps are medium; potentially-unnecessary findings are low;
- heuristic confidence can cap/reduce urgency but can never increase it;
- `JS-RECOMMEND-015@1` converts supported finalized findings into evidence-backed actions after
  priority while preserving factual/heuristic basis and confidence;
- recommendations never execute changes and do not claim an automatic migration/removal is safe;
- `JS-COVERAGE-018@1` produces category scoring coverage facts/limitations;
- dependency coverage requires complete supported project/source usage plus complete usable npm
  latest metadata;
- security coverage requires exact dependency versions, a complete bound OSV source, complete
  exact-version query results, and explicit query-level provenance evidence;
- the OSV adapter now emits one source-bound query evidence record per exact package/version query,
  including zero-match results, without describing them as proof of security;
- `@stacklens/scoring` implements `stack-health-v1` behind analyzer-core's existing
  `AnalysisScorer` interface;
- scoring v1 deducts critical/high/medium/low findings by 40/25/12/5 points respectively from a
  category whose evidence coverage is complete;
- Dependencies and Security are the only numeric categories in v1;
- Maintainability, Testing, and Tooling are explicitly N/A/insufficient evidence until accepted
  complete-coverage policy exists;
- any material category limitation makes that category N/A rather than converting missing evidence
  into a score penalty;
- the v1 overall score is the arithmetic mean of Dependencies and Security only when both are
  available, with evidenceCoverage=40 to disclose that only two of five accepted category families
  are numeric;
- score contributions reference their triggering finding evidence and `SCORE-STACK-001@1`;
- priority mappings, score weights, category coverage, and overall formula are recorded in ADR-0011;
- no UI/API/worker code recalculates policy, and analyzer-core required no formula changes.

Primary traceability:

`FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021,
DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, DATA-006,
SCORE-001, SCORE-002, SCORE-003, SCORE-004,
NFR-001, NFR-002, NFR-003, NFR-004, NFR-005,
SEC-001, SEC-002, GOV-002, GOV-006, GOV-007`.

## 14. Completed milestone: repository analysis orchestration

PR #21 implements the first bounded Milestone J hosted-analysis vertical slice.

Accepted implementation:

- new `@stacklens/analysis-orchestration` package is reusable by API and Worker without either app
  depending on the other;
- `productionJavaScriptAnalyzer` binds the current production fact/finding rules,
  `JS-PRIORITY-016@1`, `JS-RECOMMEND-015@1`, and `stack-health-v1` without moving their policy
  into application code;
- `analyzePublicGitHubRepository` resolves the injected public GitHub provider snapshot, validates
  the root manifest, creates the static project/source-usage snapshot, collects bounded npm/OSV
  metadata, and invokes analyzer-core;
- GitHub acquisition/missing/invalid root manifest failures are terminal application errors;
- npm/OSV provider failures remain non-terminal report sources/partial failures so unrelated findings
  can still complete;
- OSV acquisition is attempted only for exact semantic-version declarations accepted by the shared
  JavaScript semantic-version parser;
- metadata acquisition is deterministically bounded to 100 unique package identities and 100 OSV
  exact-version queries; overflow becomes an explicit resource-limit limitation rather than negative
  evidence;
- transport-independent progress exposes repository/manifest/npm/OSV/analysis state and counts only;
- transient manifest/source/script contents are not copied into returned progress/report data;
- repository input records validated owner/name/ref/immutable commit and a commit-based fingerprint;
- full synthetic integration tests exercise the production analyzer composition and contract-valid
  report output without live external services;
- the architecture diagram now correctly shows provider I/O before analyzer-core rather than from the
  analyzer itself;
- Fastify, Graphile Worker, PostgreSQL persistence, and React UI remain outside this PR.

Primary traceability:

`FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002, GOV-006, GOV-007`.

## 15. Completed milestone: persistent repository jobs and progress state

PR #22 implements Milestone J2 around the shared repository workflow.

Accepted implementation:

- `@stacklens/persistence` owns the Drizzle/PostgreSQL `analysis` and `analysis_report` model;
- durable state stores public repository coordinates, progress/status, immutable commit/fingerprint,
  analyzer/rule/scoring/report versions, timestamps, failure summary, and final report JSON only;
- `@stacklens/repository-jobs` owns the `repository_analysis` task identity, minimal source-free
  payload, enqueue seam, and transient-progress → durable-stage mapping;
- unknown queue payload fields are rejected so source/manifest/script/provider bodies cannot enter
  durable queue storage;
- the stable analysis-ID Graphile key uses dedupe-only behavior so a repeated enqueue cannot replace
  and exhaust a locked in-flight job;
- `apps/worker` composes Graphile Worker with the existing repository orchestration and real
  GitHub/npm/OSV provider adapters;
- active Graphile job ownership prevents a stale/duplicate job from mutating progress or terminal
  output for another in-flight execution;
- the same Graphile job can reclaim after interruption, supporting retries without cross-job races;
- retryable failures are returned to Graphile before the final attempt;
- the final attempt persists StackLens `failed` state and finishes the Graphile task, avoiding a
  permafailed queue row as the only failure record;
- successful reports with material limitations/partial failures persist as
  `completed_with_limitations`;
- PostgreSQL timestamps are normalized to ISO 8601 at the repository boundary;
- the permanent quality workflow provisions PostgreSQL 18 and runs integration coverage;
- Fastify and React remain outside this PR.

Primary traceability:

`FR-003, FR-004, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-003, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007`.

## 16. Completed milestone: repository-analysis HTTP transport

PR #23 implements the accepted Fastify REST/OpenAPI boundary over the
durable J2 job flow.

Accepted implementation:

- `apps/api` now constructs a Fastify 5 application with Zod validation/serialization and
  `@fastify/swagger` OpenAPI generation;
- `POST /v1/analyses/repository` accepts only a supported public HTTPS GitHub repository URL;
- authoritative URL validation/canonicalization reuses `@stacklens/data-sources` rather than
  creating a second GitHub URL policy in Fastify;
- the API boundary generates a non-guessable UUID analysis ID and delegates persistence/enqueueing to
  `@stacklens/repository-jobs`;
- successful submission returns `202 Accepted` with only the stable analysis identifier;
- `GET /v1/analyses/:analysisId` reads `@stacklens/persistence` for coarse durable
  status/progress and terminal report/failure state;
- active Graphile job IDs, internal queue tables, retry counters, source bodies, manifest text,
  scripts, provider bodies, and secrets are not part of the public status contract;
- completed analyses require their transactionally persisted `AnalysisReport`; inconsistent
  completed-without-report state is treated as service unavailable instead of fabricated output;
- request/schema errors are stable and source-free; dependency failures return a generic `503`
  without leaking low-level provider/database/queue details;
- `GET /openapi.json` publishes OpenAPI 3.1 from the same Zod schemas used by route validation and
  response serialization;
- the API does not import `apps/worker` or reconstruct provider/analyzer sequencing;
- focused Fastify injection tests cover submission, strict validation, queue failure, progress,
  terminal report/failure, not-found behavior, and OpenAPI publication.

Primary traceability:

`FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007`.

## 17. Completed milestone: repository-analysis web flow

Milestone K1 introduces the first production React application in `apps/web`.

Accepted implementation:

- React 19 + Vite remain the ADR-0005 client runtime;
- TanStack Router owns `/` and the stable `/analyses/$analysisId` route;
- a small runtime-validated client adapter submits public repository URLs to
  `POST /v1/analyses/repository`;
- TanStack Query polls `GET /v1/analyses/:analysisId`, forwards cancellation, and stops at terminal
  public statuses;
- progress renders coarse durable stages only and never derives percentage progress;
- terminal failure is distinct from `completed_with_limitations`;
- terminal reports are runtime-validated with the shared `AnalysisReportSchema`;
- report screens reuse `@stacklens/ui` finding/evidence/limitation vocabulary while keeping screen
  composition in `apps/web`;
- React renders report-owned priority, confidence, recommendations, evidence, and scores rather than
  reconstructing analyzer/scoring policy;
- evidence referenced by a finding is inspectable from the report without provider calls;
- focused tests cover transport parsing, advisory URL validation, value preservation, progress,
  failure, limited completion, and evidence disclosure;
- quick-manifest HTTP transport and UI remain outside K1.

Primary traceability:

`FR-003, FR-004, FR-017, FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007,
GOV-002, GOV-006, GOV-007`.

See `docs/implementation/repository-web.md` and `apps/web/README.md`.


Post-K1 runtime composition is also implemented: `compose.yaml` provisions local PostgreSQL,
`apps/api` and `apps/worker` expose executable dev/start entrypoints, the API composes real
Drizzle/Graphile queue adapters, and `pnpm dev` runs web/API/worker together. This is infrastructure
composition only and does not change repository-analysis product semantics.

See `docs/implementation/local-development.md`.

## 18. Completed milestone: automated MVP acceptance hardening

The first bounded MVP acceptance pass now has automated coverage at the two integration seams that
were previously only implied by focused tests.

### Production web router smoke

`apps/web/src/mvp-acceptance.test.tsx` renders the actual production TanStack Router and verifies one
continuous anonymous user journey:

1. analyzer home -> `/quick`;
2. pasted package.json -> synchronous manifest report;
3. explicit manifest-only N/A/limitation semantics;
4. StackLens home navigation -> repository analyzer;
5. public repository submission -> stable `/analyses/:analysisId` route;
6. terminal repository report.

The test uses the production client singletons and mocks only their network methods. It therefore
checks route registration/composition, form wiring, mutation/query handoff, and shared report
rendering without requiring live GitHub/npm/OSV.

### Composed API runtime smoke

The PostgreSQL-backed `apps/api/test/runtime.test.ts` now verifies both public execution models
through `createStackLensApiRuntime`:

- repository submission reaches the real Drizzle/Graphile adapters and becomes durably queued;
- quick manifest analysis runs synchronously through the composed Fastify runtime and its returned
  analysis ID is absent from durable repository-analysis state.

This preserves the accepted distinction between asynchronous repository analysis and anonymous,
non-persistent quick analysis.

See `docs/implementation/mvp-acceptance.md`.

## 19. Immediate next milestone: manual browser acceptance and release readiness

Beyond the bounded acceptance-driven evidence hardening recorded below, do not add another
analyzer/provider capability yet. Run the remaining checks that require a real browser and locally
running three-process stack:

- fresh-checkout `pnpm install && pnpm dev:infra && pnpm dev`;
- quick paste and local-file flows against the real local Fastify process;
- repository submission -> real Worker progress -> terminal report against a small public fixture;
- keyboard-only navigation and focus behavior;
- narrow and wide viewport review;
- validation/error recovery with the live proxy/API boundary;
- browser console/network review for source-content leakage or unexpected calls;
- OpenAPI/client request agreement in the running deployment topology.

One concrete live-provider failure has now been identified during this pass: anonymous GitHub REST
acquisition can return `403` when the public API rate limit is exhausted. The hardening path keeps
FR-003 public-repository semantics unchanged while allowing an operator/developer
`STACKLENS_GITHUB_TOKEN` for authenticated read-only public REST calls, classifying rate-limit
`403`/`429` responses from safe headers, and preserving clear retry guidance without provider-body
or token leakage. This does not implement FR-100: private repositories remain rejected and there is
no user-connected GitHub account flow.

Re-run a real public repository analysis after this hardening, including the unauthenticated path
when quota is available and the optional-token path when repeated live testing would otherwise hit
anonymous limits.

A second acceptance issue exposed that ordinary semver ranges such as `^19.0.0` left
version-specific npm/OSV/scoring rules at insufficient evidence even when the committed repository
already contained an authoritative package-manager lockfile. FR-023 now accepts normalized direct
resolution evidence from root `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` when the
dependency name and exact package.json specifier match deterministically. Exact manifest versions
still work without a lockfile. Ambiguous/stale/malformed/workspace/non-semver lockfile states remain
limitations rather than guesses.

Repository analysis uses the resolved exact current version for npm version-specific rules, OSV
queries, migration comparison, and version-health coverage. The later evidence-recovery work in
PR #37 advances production analyzer/rule-set identities to v3 and scoring to v2 under ADR-0012.
Quick analysis remains package.json-only and provider-free.

Manual acceptance must therefore also re-run a public repository that commits a supported lockfile
and uses ranged dependency declarations, confirming that resolved-version evidence is visible and
numeric categories become available only when their documented required evidence is complete.
The same KerjaLog commit was reanalyzed with all 351 supported source files and all 47 npm packages
available, no provider failures, and one honest unresolved ESLint preset limitation. Its five v2
scores are available; this does not imply general code quality or passing tests. See the
implementation record for the immutable commit and verification scope.

Fix only concrete acceptance failures. If a fix changes product behavior beyond existing
requirements, update the requirement first or in the same PR.

## 20. What not to do next

Until manual acceptance/release readiness is complete:

- do not merge the quick synchronous path into repository polling/background jobs;
- do not add multipart upload when the accepted JSON file contract already serves browser input;
- do not duplicate analyzer, validation, priority, recommendation, or scoring semantics in React;
- do not add user-connected GitHub authentication/private-repository support beyond the bounded
  operator token used only for existing public REST acquisition; do not add AI analysis,
  code-writing automation, CLI/IDE surfaces, or monitoring/history;
- do not weaken insufficient-evidence/N/A behavior to make the report appear more complete.

## 21. Pull-request strategy for the next session

Prefer small hardening PRs tied to an observed manual acceptance failure. Each PR must identify the
affected requirement(s), include a regression test, append the project journey, and preserve the
existing architecture boundaries.

## 22. K3 completion signal

Milestone K3 remains complete when current `main` verifies:

1. `/quick` is reachable through the production TanStack Router tree;
2. repository/package.json input modes are discoverable through the analyzer UI;
3. paste submits only the existing K2 paste JSON shape;
4. selected files are read locally and submit only the existing K2 upload JSON shape;
5. authoritative server errors preserve recoverable user input;
6. synchronous analysis has an accessible busy state without fake progress/polling;
7. success is runtime-validated with `AnalysisReportSchema`;
8. repository and quick modes reuse shared report presentation;
9. manifest-only evidence limits are prominent before score interpretation;
10. production-router acceptance and repository-wide quality checks pass;
11. README, implementation docs, journey, AGENTS, and this handover describe K3 consistently.
