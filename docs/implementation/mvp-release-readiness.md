# MVP live release validation

> **Date:** 2026-09-30\
> **Status:** Local live acceptance recorded; manual release gates remain\
> **Baseline:** `f51d2b61f4740172558bb4b38087af60af8d791a`, merged [PR #40](https://github.com/BlizzardBlast/StackLens/pull/40)\
> **Branch:** `codex/mvp-release-readiness`, existing checkout; changes uncommitted\
> **Requirements:** FR-001–FR-006, FR-010, FR-011, FR-017–FR-023, DATA-001–DATA-005, SCORE-001–SCORE-004, NFR-005–NFR-009, SEC-001–SEC-003, SEC-007, GOV-002, GOV-007

## Scope and environment

The user supplied KerjaLog and frey-ui as live acceptance inputs. Submissions used the real React
application at `localhost:5173`, its Vite proxy, Fastify at `127.0.0.1:3000`, PostgreSQL 18,
transactional delivery and the actual Graphile Worker with live GitHub/npm/OSV adapters.
`pnpm dev` prepared the shared packages before starting all three applications.

The Windows host used Node 24.19.0 and pnpm 12.4.2. The database was disposable and isolated from
the default application database. Browser callers supplied no account/authentication; the GitHub
adapter used the operator token already configured locally. The token value was neither recorded
nor included in reports. This pass does not establish the behavior of large repositories under
GitHub's token-free request quota.

No analyzed repository code, configuration, scripts, hooks, tests, builds or dependency installations
were executed. Root manifests used for paste/upload were fetched at the immutable commits below,
read as data and kept only in a task-owned temporary directory.

The [machine-readable evidence](release-evidence/2026-09-30.json) contains selected report metadata,
counts, exact revisions, provider outcomes, score states and measured accessibility results. It
contains no acquired source/configuration bodies or operator credentials. Analysis IDs below are
historical identifiers; the disposable database is removed after validation.

## Live repository results

| Input | Immutable commit | Baseline v5 | Corrected v6 | Final state |
| --- | --- | --- | --- | --- |
| [KerjaLog](https://github.com/BlizzardBlast/KerjaLog) | `9e5f869bbcf5b9d582f8e1453395ea2c06c79f83` | 53.438 s | 61.327 s | `completed_with_limitations` |
| [frey-ui](https://github.com/BlizzardBlast/frey-ui) | `6dbd184ace64d28c6a7ca7c2c75263215f4ac9bf` | 45.951 s | 57.914 s | `completed_with_limitations` |

Times are durable creation-to-terminal durations, including queueing. Both v6 jobs ran concurrently
with Worker concurrency 2. These are observed samples, not a load test or a latency guarantee.

| Run | Analysis ID |
| --- | --- |
| KerjaLog v5 | `7bd51d91-adac-43a3-8452-ea31f4dd9dc6` |
| frey-ui v5 | `c07b8957-994c-4555-a6bf-4a7d9c48f2ed` |
| KerjaLog v6 | `5961ca36-7ae3-447e-82d3-7ed19d04653f` |
| frey-ui v6 | `af229bbd-29f4-4b78-bd36-6de87483c5f5` |

Both final reports passed the shared `AnalysisReportSchema`, used schema 2.0.0,
`javascript-production-v6`, `javascript-rules-v6` and `stack-health-v3`.

KerjaLog retained 47 dependency declarations and 47 exact lockfile resolutions, 289 facts,
32 findings and five raw limitations. All 47 npm sources, GitHub and OSV were available. Dependencies,
Security and Tooling scored 100; Maintainability, Testing and Overall stayed insufficient evidence.
Opaque preset/configuration and test-selection evidence remain explicit. An available Security 100
means zero supported active advisory matches for the exact queries, not proof of safety.

frey-ui retained four package scopes, 67 dependency declarations, 63 external resolutions and two
verified internal edges. It produced 403 facts and 61 findings. Internal `@frey-ui/storybook` and
`frey-ui` workspace links stayed out of npm/OSV requests and remained inventory/resolution facts.
The corrected report contains 25 raw limitations, presented as 12 grouped causes, plus four partial
acquisition failures:

- npm metadata for `chromatic`, `storybook` and `vite` exceeded the existing 16,777,216-byte response
  bound; each remains a typed `npm_response_too_large` failure;
- one selected GitHub file, `packages/frey-ui/src/FileUpload/fileValidation.coverage.test.ts`, timed
  out on the v6 rerun. The GitHub source remains partial and the omitted path is disclosed.

The baseline frey-ui acquisition had no GitHub file failure. Provider availability changed between
runs at the same revision; the record preserves both outcomes. Response bounds and timeouts were
not relaxed to obtain a cleaner score.

OSV matched [GHSA-82fw-gwwq-j7x9](https://osv.dev/vulnerability/GHSA-82fw-gwwq-j7x9) to lockfile-resolved
`vitest@4.1.10` in the root, `apps/storybook` and `packages/frey-ui`. Three package-scoped findings
share one advisory and one package name. Supported CVSS 3.1 base severity is medium (5.9); the
supplied Security band is medium and score 70. This is advisory evidence, not demonstrated
application exploitability. Testing and Tooling scored 100 for supported static setup;
Dependencies, Maintainability and Overall remained insufficient evidence. Static setup scores do
not claim that repository tests passed or measure coverage.

PostgreSQL recorded four terminal reports and one terminal failed analysis. All five source-free
delivery records were delivered on their first attempt; the Graphile queue was empty after
completion. Browser polling exposed named stages, never fabricated percentages. Initial KerjaLog
browser responses included queued, resolving repository, collecting snapshot, collecting metadata
and terminal state. Sampling did not capture every short-lived stage; the machine record labels
collector observations separately.

## Acceptance paths

| Requirement | Observed result |
| --- | --- |
| FR-001, FR-004, FR-022 | Real KerjaLog manifest paste returned HTTP 200, 47 declarations, quick-manifest v5 and explicit evidence limits. Invalid JSON preserved the text and displayed the server message. |
| FR-002 | Native browser file selection read a KerjaLog manifest, then replaced it with frey-ui before submission. The final JSON upload contained the replacement file and returned its ten root declarations. |
| FR-003, NFR-008 | Both supplied public repositories completed through the actual Worker. A nonexistent public repository returned terminal `failed` with `repository_unavailable`, distinct from partial success. |
| FR-004 | Malformed HTTP JSON, unsupported content type, unknown request fields, invalid dependency groups, wrong upload filename and non-GitHub URLs returned stable actionable 400 errors. OpenAPI 3.1.0 exposed all three analysis routes. |
| FR-017–FR-021 | Evidence/provenance, package-scoped advisories, supplied scores, grouped limitations and acquisition failures rendered in both reports. Unknown scores remained N/A. |
| NFR-006 | Mode selection, report completion/reset and inline evidence Close were checked with keyboard/DOM evidence. Close returned visible focus to its trigger; completion/reset focused the corresponding heading. |
| NFR-007 | Actual CSS widths 1280 and 320 were verified in both themes. Document/body widths stayed within each viewport. Screenshots cover representative report and form states. |
| NFR-008 | An authoritative missing-analysis 404 stopped automatic interval/focus retries; manual Try again made another request. React development mode also produced a canceled initial request, which is not counted as a completed 404. Terminal repository polling stopped before the intentional runtime restart. |
| NFR-009, SEC-001–SEC-003 | Both quick analysis IDs returned 404 from durable lookup. Reports contained no raw-input/credential fields or operator token; an ignored synthetic privacy marker was absent. The browser contacted only the local origin; provider acquisition occurred on the server. |

The quick paste ID was `f65c160d-1088-40ba-85a3-e9f8b396fa00`; the replacement upload ID was
`c68b5625-e23d-4de8-95ac-6a88bd1e035f`. Both reports had zero external sources and all category scores
were insufficient evidence. Quick analysis did not create database/queue state. Busy-state and
delayed-read race guarantees also retain deterministic regression coverage; the live provider pass
does not replace those tests.

The nonexistent-repository failure ID was `fbbef55a-d08f-46af-a830-36aac0cafd4b`. Its non-retryable
GitHub 404 finished the queue task and persisted a useful terminal failure. This tested real failure
presentation without synthetic browser responses.

## Gaps closed

1. Quick input-mode cards placed `aria-label` on their roleless `<label>` wrappers. axe reported
   unsupported naming as a manual-review item. Native radios now reference visible title/help
   text with `aria-labelledby` and `aria-describedby`. Exact-name/description regressions and live
   Space/arrow-key selection verify the correction (FR-001/002, NFR-006).
2. npm health evaluation examined internal workspace declarations although acquisition correctly
   excluded them. frey-ui consequently displayed missing-npm messages for its two internal links.
   `JS-NPM-010@2` now applies the shared external-declaration predicate before grouping. Regressions
   cover internal, unresolved, workspace-prefixed and peer-only declarations, plus same-name external
   evidence. Production analyzer/rule-set identities advance to v6. The live rerun removes those two
   messages while retaining genuine external-provider failures (FR-005/010/023, DATA-001/002).
3. The full gate exposed three existing report/router/focus tests exceeding the five-second timeout
   under the default web worker count. With two isolated workers, all 52 web tests passed in 15.82 s,
   compared with the failed 32.32 s run. The web Vitest configuration now caps workers at two while
   preserving isolation, assertions and the default timeout. This follows Vitest's documented
   [worker-count control](https://github.com/vitest-dev/vitest/blob/main/docs/config/maxworkers.md)
   and is a test-runtime correction (GOV-007).

Self-review checked declaration-level filtering before name grouping, package-scoped evidence,
preservation of genuine missing-provider limitations, native radio semantics and traceable version
changes. The first full gate also caught an unsupported Testing Library `exact` option in the new
test; it was removed, preserving exact string-name matching. Schema 2.0.0, historical readers,
quick-manifest v5, priority and scoring formulas stay as
documented; historical JSONB is neither rewritten nor rescored.

## Accessibility and visual evidence

Trusted axe-core 4.13.0 ran with WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags. It was installed only in the
temporary validation directory, with lifecycle scripts disabled. No repository dependency changed.

Sixteen final scans cover both live reports and both input modes at 1280/320 CSS pixels in light/dark
themes with reduced motion. All reported zero violations, no horizontal page overflow and no running
animations. Each report scan passed 24 applicable rules; each form scan passed 23. Contrast
manual-review items remained for 64 KerjaLog glyphs, 122 frey-ui glyphs and two form checkmarks. Their
DOM targets were all decorative, `aria-hidden` symbols (`◆`, `●`, `→`, `✓`); visible text carries
the meaning. These incomplete items were reviewed separately and are not counted as automated passes.

An initial browser viewport capability did not change existing tabs' CSS width. Those readings were
discarded. Final scans use per-tab device-metrics overrides and assert the measured `innerWidth`.
Emulation was reset and only task-created tabs were closed after capture.

- [KerjaLog desktop, light](../design/review-assets/release-20260930-kerjalog-desktop-light.jpg)
- [KerjaLog 320px, dark](../design/review-assets/release-20260930-kerjalog-mobile-dark.jpg)
- [frey-ui 320px, dark](../design/review-assets/release-20260930-frey-mobile-dark.jpg)
- [Quick upload report 320px, dark](../design/review-assets/release-20260930-quick-mobile-dark.jpg)
- [Corrected quick form 320px, dark](../design/review-assets/release-20260930-quick-form-mobile-dark.jpg)

## Quality and cleanup

Final `pnpm check` passed with `TEST_DATABASE_URL` pointing to
`stacklens_release_check_20260930`: build, fresh compiled API/Worker smoke, shadcn configuration,
strict typecheck, all 22 test-graph tasks, lint and formatting. The graph contains 491 Vitest tests
and ten design-token tests (501 total). Turbo reused 21 successful test tasks; the changed web suite
ran freshly and passed all 52 tests in 14.46 s. Earlier attempts exposed the test query typing,
worker contention and a required typed mock; each was corrected before the successful gate.

Existing non-blocking output includes the 510.88 kB minified / 155.27 kB gzip web chunk warning and
Graphile's Windows executable-detection warning. Neither is treated as evidence of a runtime or
accessibility pass. Bundle optimization remains a separate performance follow-up.

Cleanup completed after verifying zero connections to both task databases. The release and quality
databases were dropped and their absence verified. Task application processes, the Compose container
and network were removed; ports 3000, 5173 and 55432 returned to unused. The default database and
PostgreSQL volume were preserved, and the already-running Docker engine stayed running. Browser
emulation and the task JavaScript kernel were reset. All temporary manifests, raw reports, helper
tools and logs were removed after saving the selected evidence and screenshots.

## Remaining release gates

- Run a real screen-reader journey on an installed assistive technology: input-mode names/help,
  error announcement, progress-to-terminal transition, evidence open/Close and quick completion/reset.
  DOM, axe and keyboard observations do not establish actual spoken output or WCAG certification.
- Check a physical narrow/touch device and another target browser. The recorded 320px evidence is
  Chromium CSS emulation, not physical-device validation.
- Before a deployed release, validate the chosen host's production proxy/TLS, provider credentials,
  limits, database retention/backups and compiled process configuration. This pass did not deploy or
  inspect a production environment. New branch CI must run after publication.

Accepted requirements already cover the product corrections. No new feature, threshold, technology choice, schema
migration or ADR is needed. The documentation-impact pass updates the current handover, README,
acceptance/orchestration/rule/quick-flow documentation, design user flow, agent identity and journey.
Web testing documentation also records the worker limit.
The earlier review ledger and chronological entries retain their original historical evidence.
