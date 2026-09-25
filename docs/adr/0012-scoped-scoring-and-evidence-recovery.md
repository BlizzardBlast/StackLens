# ADR-0012: Scoped scoring v2 and evidence recovery

- **Status:** Accepted
- **Date:** 2026-09-25
- **Requirements:** FR-003, FR-006–FR-010, FR-013–FR-021, FR-023, DATA-006,
  SCORE-001–SCORE-004, SEC-001, SEC-002, NFR-001–NFR-007, GOV-003, GOV-006, GOV-007
- **Supersedes:** ADR-0011 scoring coverage and overall formula; existing priority mappings remain.

## Context

A real repository exceeded the 32-file acquisition budget. One historical npm version with
`deprecated: false` invalidated all React metadata. Three categories always returned insufficient
evidence because their policies were unimplemented. Binary score eligibility was labeled as an
evidence percentage. Repeated notices obscured the causes.

## Decision

Use `stack-health-v2` with five explicit, bounded scopes. All deductions retain the existing
priority mapping (40/25/12/5 for critical/high/medium/low); every deduction references a finding.

| Category | Supported scope and coverage gate | Scored findings |
| --- | --- | --- |
| Dependencies | Exact current versions and complete source-bound npm current/latest metadata for every supported declaration | Outdated, deprecated, and curated overlap findings |
| Security | Complete source-bound OSV exact-version queries for every supported declaration | Known-advisory findings |
| Maintainability | The same complete version metadata required to assess major-version migration opportunities | Major-version migration findings |
| Testing | Root manifest test-command inspection and conventional repository test-file observation; absence requires complete source acquisition | Missing supported test command and missing conventional test files |
| Tooling | Root manifest package-manager pin and supported root lockfile observation/normalization; absence requires complete acquisition | Missing exact package-manager pin and missing committed supported lockfile |

Testing and Tooling are setup/readiness checks, not assertions that tests passed, runtime coverage
is adequate, tooling ran, or the project is generally well maintained. Custom test commands that
cannot be interpreted, unsupported lockfiles/managers, and stale/partial lockfile resolutions
produce limitations, not deductions. Known test runners must be declared; Node's built-in test
runner needs no dependency. Test-file detection is limited to supported `.test.*`, `.spec.*`, and
`__tests__` source paths. Missing setup is a medium-confidence heuristic with low priority. Its
recommendation asks the user to review the convention rather than claiming that tests do not exist.

Missing package-manager pins are likewise a low-priority reproducibility heuristic. Unsupported
pins remain insufficient evidence; a recognized unpinned npm/pnpm/yarn value is an observable gap.
For dependency-free projects the lockfile check is not required; the supported pin check remains.

Coverage facts are authoritative for these scopes. Limitations about unrelated source usage or
dynamic configuration remain visible but do not block version-health/migration scores. Rule or
priority failures that could omit scored findings still block the affected score. No UI decides
which findings are score eligible. Absence-based unused-dependency findings retain their stricter
full acquisition/parser/configuration coverage gate and do not affect the v2 version-health score.

Overall scoring requires all five category scores and uses their equal-weight arithmetic mean.
Missing evidence never becomes zero. `evidenceCoverage` remains the score-eligibility field in the
existing serialized shape: category 0/100 and overall available-category fraction. Presentation
must label it as score availability, never file/package evidence coverage. Category scope and
blocking limitations are visible alongside each score. Stored v1 reports are not rescored, and
their three unimplemented categories are labeled as such. The report schema remains unchanged;
analyzer/rule-set/scoring versions distinguish the new behavior.

GitHub acquisition defaults become 512 files, 520 requests, and 8 MiB total retained content, with
the existing 512 KiB per-file bound. Manifest/lockfiles remain first. Resource exhaustion and
rate limiting remain explicit. No repository code is executed.

The parser adapter handles literal configuration exports, local immutable constants, and
recognized `defineConfig` wrappers. It never resolves imported presets, executes calls, imports
configuration modules, or infers dynamic values. Unsupported portions stay partial; supported
high-level information remains available. Repeated equivalent limitation messages are grouped
for display with their original category/rule references preserved.

## Consequences

All five categories have meaningful, testable policies and visible scope. A partial source scan
can coexist with complete dependency version checks. A healthy score is specific to the documented
checks, not a universal guarantee. Scores produced under v1 and v2 are not directly comparable.
Larger repositories require more authenticated GitHub requests; finite limits still apply.

Synthetic tests cover provider compatibility, realistic file counts, immutable reads, truncation,
static parser safety, positive/negative/unknown readiness checks, scoped scoring, and legacy report
presentation. A fresh repository run validates the reported failure case without changing its
historical report.
