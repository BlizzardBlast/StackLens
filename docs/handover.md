# StackLens Session Handover

> **Prepared:** 2026-10-03\
> **Architecture:** v0.1.20; requirements v0.1.3\
> **Milestone:** PR #41 draft; Worker planned recovery, remote expiry and restore verified; manual gates open\
> **Branch:** `codex/mvp-release-readiness`, existing checkout; PR #41\
> **Verified main:** `f51d2b61f4740172558bb4b38087af60af8d791a`, confirmed through the remote main ref\
> **Traceability:** PRD-006, FR-001/003/004/022, NFR-004/006/007/008/009, SEC-001/002/003/007, GOV-002/006/007

## Current handover

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
Documentation pushes can rebuild both targets. The PR stays draft; no merge has been authorized.
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
CI/deployments; it remains draft and no merge has been authorized.

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
A missing completed report during a cleanup/read race returns the existing 404 recovery.
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
