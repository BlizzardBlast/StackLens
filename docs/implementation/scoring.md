# Scoring Policy v2

> **Status:** Accepted implementation baseline  
> **Date:** 2026-09-25
>
> **Requirements:** FR-013–FR-023, DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-007
>
> **Decision:** ADR-0012 (supersedes ADR-0011 scoring scope/formula)

`packages/scoring` owns the pure deterministic score calculation. Ecosystem rules establish
coverage; React, API, and worker code never choose score weights or reconstruct the formula.

## Version and scopes

The current version is `stack-health-v2`, with contributions owned by `SCORE-STACK-001@2`.

| Category | What the score measures | Required evidence |
| --- | --- | --- |
| Dependencies | Supported outdated/deprecated versions and curated dependency overlap | Inventory provenance, exact current versions, complete bound npm current/latest records for every declaration |
| Security | Supported known dependency advisories | Exact versions and complete source-bound OSV queries with query provenance |
| Maintainability | Major-version migration readiness | Complete exact current/latest npm metadata for all declarations |
| Testing | Static test setup | Supported declared test-runner command and conventional test-file observation |
| Tooling | Reproducibility setup | Exact supported package-manager pin and matching committed root lockfile |

These are bounded scopes. Testing does not measure passing tests or runtime test coverage.
Maintainability does not measure general code quality. Security 100 means no supported
score-impacting known advisory matches in complete exact-version OSV queries, not universal security.

Testing recognizes declared Jest, Vitest, Mocha, AVA, Jasmine, Tape, Playwright, and Cypress commands
at the beginning of a root package script, optionally behind supported package-manager launchers,
plus `node --test`. Custom commands remain unresolved. Conventional test files are supported
JS/TS `.test.*`, `.spec.*`, and `__tests__` paths. No command or test is executed.

Tooling recognizes exact npm/pnpm/Yarn `packageManager` versions and existing supported lockfile
normalization. Unknown managers, incomplete/stale resolutions, and ambiguous lockfiles remain N/A.
Dependency-free projects require only the supported manager-pin check.

Observed absence of setup is a medium-confidence heuristic with low priority. Test-file/lockfile
absence requires complete relevant acquisition. A positive observation may remain usable in a
partial scan. Missing provider/file evidence itself never creates a negative finding.

## Coverage gates

Numeric scores require explicit `analysis.coverage.<category>` facts. `JS-COVERAGE-018@3` owns
Dependencies, Security, and Maintainability coverage; `JS-READINESS-019@1` owns Testing and Tooling.
`JS-SETUP-019@1` produces readiness findings from completed facts, and the existing independent
prioritizer assigns their conservative low priority. Recommendations remain a separate stage.

Coverage-rule limitations and limitations from scored detector rules block their scopes. A rule
failure that could omit scored output blocks scoring even if a coverage fact exists. Unclassified
rule failures conservatively block all categories. Source-usage or dynamic-configuration warnings
remain visible but do not invalidate complete version-health or migration checks.

Potentially-unused findings still require full source/parser/configuration coverage. They remain
visible but do not deduct from the v2 dependency version-health score. Scoring filters eligible
rule families explicitly; presentation does not decide eligibility.

## Deductions and overall score

Each available category starts at 100. Eligible findings deduct points by finalized priority:

| Priority | Points |
| --- | ---: |
| Critical | 40 |
| High | 25 |
| Medium | 12 |
| Low | 5 |

Clamp category values at zero. Each contribution identifies the triggering finding, evidence,
priority rationale, and scoring rule. Setup findings therefore deduct five points each. Absence
of a scored finding means only no deductions within that scope.

Overall is the equal-weight arithmetic mean of **all five** categories, rounded to two decimals,
only when all five are available. Otherwise it is N/A and references the blocking limitations.

## Coverage display and compatibility

The serialized report shape remains unchanged. Its `evidenceCoverage` field represents score
eligibility: category 0/100, overall available categories divided by five. It is **not** a measured
percentage of files or dependency evidence acquired. The web UI displays category-score availability
and the analyzer's actual repository acquisition counts instead of a misleading evidence meter.

Stored `stack-health-v1` reports retain original values: only Dependencies and Security had policies,
the overall mean required those two, and three categories always returned N/A. The UI labels those
three as policies not implemented in that report version. Reanalysis creates a new v2 report;
historical scores are never silently recomputed. v1 and v2 scores are not directly comparable.

## Verification

Fixtures cover all five available scopes, missing/partial evidence, unsupported commands/managers,
safe static inspection, heuristic setup gaps, contribution provenance, category isolation, rule
failures, deterministic input reordering, and the five-category overall gate. Provider tests use
synthetic responses; live provider runs are supplementary evidence only.
