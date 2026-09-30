# Review findings remediation

Requirements: FR-002, FR-003, FR-005, FR-014, FR-017–FR-023, SCORE-002/003,
NFR-006–NFR-009, SEC-001/002, GOV-002/007.

## Baseline and scope

- Approved plan: fix the eight findings from the September 28–29 repository audit.
- Baseline: `962146e0352386a15d7ba40ee5eb745a918d4a6d` (`main` and `origin/main`).
- Implementation branch: `codex/review-findings`, in the existing checkout.
- Initial tracked/untracked working state: clean; no unrelated changes.
- Prior audit gate: 429 tests and database-backed `pnpm check` passed. Fresh verification is required.
- Preserve REST/report/database schemas, historical reports, scoring formulas, provider isolation,
  and static-only analysis. The remediation was verified uncommitted on September 29; the user
  authorized a review PR on September 30. Merge and deployment remain outside this task.
- Maximum three remediation sweeps across the ledger. Review and verify after every phase;
  a failed gate resumes at that phase in the next sweep. No phase resets the budget.

## Finding ledger

| ID | Severity | Location | Evidence and impact | Remediation | Verification | State |
| --- | --- | --- | --- | --- | --- | --- |
| CR-P1-001 | P1 | Workspace/lockfile normalization | npm internal links reach external providers and can inherit unrelated risk | Resolve proven links and exclude unresolved internal targets | Workspace and orchestration regressions | resolved |
| CR-P1-002 | P1 | Workspace inspection | Node discovery misclassifies test files and changes Testing scores | Runner-specific conservative discovery | Filename, coverage and scoring regressions | resolved |
| CR-P1-003 | P1 | Migration rule | Equivalent resolutions emit duplicate IDs and discard rule output | Aggregate migrations and preserve all evidence | Mixed declaration integration regressions | resolved |
| CR-P1-004 | P1 | API/Worker entrypoints | Port 5432 disagrees with Compose port 55432 | Align local defaults, preserve overrides | Isolated entrypoint tests and database runtime smoke | resolved |
| CR-P2-001 | P2 | Quick-analysis form | Selecting B while reading can submit A | Generation-bound local file state | Deferred read and cancellation regressions | resolved |
| CR-P2-002 | P2 | Repository-analysis page | 404 responses continue polling | Stop automatic 404 refetches, retain manual recovery | Timer/focus/reconnect/cancellation tests | resolved |
| CR-P2-003 | P2 | Report evidence disclosure | Closing details leaves focus on BODY | Restore trigger or Findings heading | Keyboard and fallback tests | resolved |
| CR-P2-004 | P2 | Quick-analysis page | Completion replaces focused form without announcement | Focus report/reset headings and announce completion | Page/router and browser checks | resolved |

## Phase reviews

### Sweep 1 — Phase 1

Implemented link classification, Node discovery, migration aggregation and analyzer v5 identities.
Rules tests passed (223), orchestration tests passed (15), contracts/scoring tests passed (24/12),
and the focused Turbo build/typecheck/test graph passed all 16 tasks. Root lint passed.
An older lockfile test was corrected to exclude internal targets from external resolution errors.
Self-review found two in-scope edge cases: peer-only npm constraints must not require installation
evidence, and Node positional arguments must not inherit another runner's neutral options.
The gate remains open for those corrections; no later phase started.

### Sweep 2 — Phase 1 corrections

Excluded peer-only declarations from npm link lookup and restricted supported Node default-discovery
arguments. Added focused regressions. The affected build/typecheck/test graph passed all 14 tasks.
Reviewed the complete phase diff, provider eligibility and report references. No further in-scope
defect remains in this phase. CR-P1-001/002/003 are resolved; the Phase 1 gate passes.

### Sweep 2 — Phase 2

Aligned both entrypoint defaults with Compose port 55432 and documented optional environment
overrides. Isolated module tests cover unset and explicit DATABASE_URL; tests restore environment
and test-owned signal listeners. API/Worker build, typechecks and tests passed (22 Turbo tasks),
including database integration tests on stacklens_remediation_20260929. Compiled runtime smoke
passed against that database with the unchanged smoke-only Worker task list. Reviewed the complete
phase diff and startup/shutdown callers: Fastify and analyzer composition boundaries are preserved.
CR-P1-004 is resolved and the Phase 2 gate passes.

### Sweep 2 — Phase 3

File selection now invalidates prior content immediately; generations own read completion and
submission. Clear, mode changes and unmount invalidate pending reads while pasted text survives.
Authoritative 404 errors stop interval/focus/reconnect refetches; manual retry and transient recovery
remain available. Focused form/polling regressions passed (23 tests) and web typecheck passed.
Reviewed state ownership, stale closures, request contracts, busy/status semantics and all affected
callers. No additional behavior defect found; CR-P2-001/002 are resolved and the Phase 3 gate passes.
Test mock typing and native output semantics were corrected to satisfy the repository lint policy.

### Sweep 2 — Phase 4 review

Implemented explicit-close focus restoration, disconnected-trigger fallback, quick completion/reset
focus and a stable polite completion region. UI/web builds, typechecks and tests passed, including
both report schemas through the production router (8 Turbo tasks). Browser checks covered desktop,
320px, both themes, reduced motion, keyboard focus, replacement upload and 404 recovery. A final
accessibility review found that the Phase 3 local-read status sat inside an aria-busy form, which
could defer its announcement. CR-P2-001 was reopened for a targeted correction; no scope expansion.

### Sweep 3 — Phase 3 correction and Phase 4 completion

Local-reading busy state now belongs to the file panel; its polite status is outside that busy
subtree. Request-busy form behavior stays unchanged. A regression asserts both relationships.
The UI/web build, typechecks and tests passed (8 Turbo tasks); the changed busy/status relationship
also passed a browser DOM check. Complete Phase 3/4 diffs and affected callers were re-reviewed: no
remaining in-scope defect was found. All eight findings are resolved and both phase gates pass.
This is the third and final remediation sweep; the repository-wide completion gate follows.

## Final review coverage

Scope mode: diff review and verification of the eight-finding remediation against the recorded baseline.

| Area | Coverage | Evidence and boundary |
| --- | --- | --- |
| Calculations and evidence | reviewed | Node scores 50/100; internal links excluded from risk; scoring formulas untouched |
| Analyzer identity and references | reviewed | Migration integration tests; combined sorted references; strict core validation preserved |
| Provider and untrusted-input safety | reviewed | Synthetic responses; zero npm/OSV calls for internal/unverified links; no analyzed execution |
| React and accessibility | reviewed | Generation ownership, Query cancellation, explicit-close focus, stable completion region |
| Fastify and runtime | reviewed | Default/override entrypoint tests, database integration and compiled smoke; bootstrap stays thin |
| SOLID and package boundaries | reviewed | Shared eligibility predicate, injected runtime/client seams, no policy in React or bootstrap |
| Compatibility | reviewed | Both report schemas through production router; unchanged REST/database schemas and scoring version |
| UX and layout | reviewed | 1280px/320px, both themes, reduced motion, upload replacement, keyboard cycles, 404 recovery |
| Documentation and traceability | reviewed | Requirements acceptance, current versions, implementation/design guidance, handover and journey |
| Actual screen reader / physical device | not performed | Browser DOM and keyboard evidence only; no assistive-technology certification claim |

Regression evidence: workspace-npm-links.test.ts (root/member/scoped/hoisted/nested/ambiguous/unsafe),
workspace-inspection.test.ts (Node patterns, partial coverage, runtime-dependent selection and scores),
migration-identity.test.ts (combined declarations, distinct versions/scopes, limitation deduplication),
repository-analysis.test.ts (provider isolation and valid report references), API/Worker main.test.ts
(defaults/overrides), quick-analysis-form.test.tsx (stale reads and busy/live relationships),
repository-analysis-page.test.tsx (404, timers, focus/reconnect, transient/manual recovery, terminal
statuses and abort), analysis-report-view.test.tsx (trigger/fallback/filter/unmount),
quick-analysis-page.test.tsx and mvp-acceptance.test.tsx (completion/reset and schemas 1/2).

Final code-review completeness: COMPLETE for this remediation diff. Decision: APPROVE. The full completion gate passed as recorded below. Resolved for the eight-finding scope; this does not assert
whole-repository correctness. No unrelated code findings were added to this remediation scope.

## Completion gate and cleanup

Final `pnpm check` with `TEST_DATABASE_URL` passed on September 29, 2026:

- Build: 12 Turbo tasks passed; compiled API/Worker database runtime smoke passed.
- UI configuration inspection and typecheck passed (21 typecheck graph tasks).
- Tests: 491 passed across the complete graph (22 tasks), including 11 persistence tests and
  2 API runtime database integration tests. Cached package results remain keyed to the test URL.
- Lint and formatting passed without diagnostics; `git diff --check` passed.
- Contracts, database schema, lockfile/dependency versions and scoring implementation are unchanged.
- Browser/DOM checks passed at 1280px and 320px in light/dark themes with reduced motion. Keyboard
  opening/closing and completion/reset focus worked. Upload B was the only submitted content while
  replacement reads blocked submission. After the development StrictMode initial requests, no
  additional 404 polling/focus/reconnect request occurred; manual recovery made an active request
  and one terminal follow-up, then stopped. No horizontal page overflow was measured.

The first full run timed out after 5 seconds in an unchanged persistence test, followed by a lease
assertion failure. All 11 persistence tests passed in isolation in 1.67 seconds and in the subsequent
full gate; no persistence code or timeout setting was changed. The next full run reached lint and
flagged sequential awaits in the new keyboard test. Parameterized trigger cases preserve sequential
keyboard interactions without the loop diagnostic; the final combined gate passed. These verification
corrections did not introduce a fourth behavioral remediation sweep.

Existing non-blocking Vite bundle-size and Graphile Windows executable-detection messages remain.
No database-backed check was skipped in the final gate. Actual screen-reader and physical-device
validation were not performed; unsupported static-analysis inputs remain explicit limitations.

The task-owned database `stacklens_remediation_20260929` was dropped after confirming no active
connections; PostgreSQL confirmed zero databases with that name. The initially stopped
`stacklens-postgres-1` container was stopped again. The browser routes and Vite server were closed.
No user database, source repository data, or unrelated resource was removed.

All eight ledger IDs are resolved, with no unresolved in-scope regression. Scope decision: APPROVE.
The September 29 implementation gate left changes uncommitted on `codex/review-findings`.
The September 30 follow-up authorized commit, push and a review PR. No merge or deployment occurred.

## September 30 final-review correction

The subsequent read-only review of PR #40 found one remaining CR-P1-001 path. With an acquired
same-name workspace member, no lockfile and no package-manager hint, the resolver returned an
external declaration with no workspace limitation. Repository orchestration could then request
npm metadata and exact-version OSV data. This contradicted the accepted missing-evidence behavior.

The follow-up treats this case as an unresolved internal target, not a verified internal edge. An
explicit non-npm manager or an authoritative non-npm lockfile retains its existing boundary;
declarations without a matching acquired member remain external. Focused regressions failed before
the correction, then passed. Both affected package suites and typechecks passed. A fresh
`pnpm check` with `TEST_DATABASE_URL` passed build, compiled runtime smoke, UI configuration, typecheck,
all 22 test-graph tasks, lint and formatting, including database-backed persistence/API checks.
The dedicated `stacklens_pr40_followup_20260930` database was dropped after confirming zero active
connections and zero remaining databases with that name. The originally stopped PostgreSQL
container and Docker Desktop engine were stopped again. No analyzed repository content was
executed. This correction follows the original three-sweep ledger rather than rewriting its history.

## Exact working-tree changes

The following paths are the complete remediation inventory relative to baseline `962146e`.
`M` means modified; `A` means added relative to the baseline.

```text
M AGENTS.md
M README.md
M apps/api/src/main.ts
M apps/web/src/features/analysis-report/analysis-report-view.test.tsx
M apps/web/src/features/analysis-report/analysis-report-view.tsx
M apps/web/src/features/quick-analysis/quick-analysis-form.test.tsx
M apps/web/src/features/quick-analysis/quick-analysis-form.tsx
M apps/web/src/features/quick-analysis/quick-analysis-page.tsx
M apps/web/src/features/repository-analysis/repository-analysis-page.tsx
M apps/web/src/mvp-acceptance.test.tsx
M apps/worker/src/main.ts
M docs/architecture.md
M docs/design/journey.md
M docs/design/report-evidence.md
M docs/design/user-flows.md
M docs/handover.md
M docs/implementation/analyzer-core.md
M docs/implementation/local-development.md
M docs/implementation/quick-analysis-web.md
M docs/implementation/repository-analysis.md
M docs/implementation/repository-web.md
M docs/implementation/rules-javascript.md
M docs/implementation/scoring.md
M docs/implementation/workspace-inspection.md
M docs/requirements.md
M packages/analysis-orchestration/README.md
M packages/analysis-orchestration/src/production-javascript-analyzer.ts
M packages/analysis-orchestration/test/repository-analysis.test.ts
M packages/rules-javascript/src/lockfile.ts
M packages/rules-javascript/src/manifest.ts
M packages/rules-javascript/src/migration-opportunity.ts
M packages/rules-javascript/src/workspace-inspection.ts
M packages/rules-javascript/src/workspace-rules.ts
M packages/rules-javascript/src/workspace.ts
M packages/rules-javascript/test/lockfile.test.ts
M packages/rules-javascript/test/workspace-inspection.test.ts
M packages/ui/src/domain/finding-card.tsx
A apps/api/test/main.test.ts
A apps/web/src/features/quick-analysis/quick-analysis-page.test.tsx
A apps/web/src/features/repository-analysis/repository-analysis-page.test.tsx
A apps/worker/test/main.test.ts
A docs/implementation/review-findings-remediation.md
A packages/rules-javascript/test/migration-identity.test.ts
A packages/rules-javascript/test/workspace-npm-links.test.ts
```
