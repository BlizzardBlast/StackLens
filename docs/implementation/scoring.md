# Scoring Policy v3

Status: accepted, 2026-09-27. Requirements: FR-007, FR-011, FR-018–FR-023,
DATA-006, SCORE-001–SCORE-004. Decision: ADR-0013 supersedes ADR-0012 scoring.

## Ownership and version

packages/scoring owns stack-health-v3 and SCORE-STACK-001@3. Synchronous rules produce
source-backed inspection checks; React, Fastify and Worker render or transport the supplied decisions.
Finding priority is a separate triage policy and never selects numeric deductions.

| Category | Meaning | Calculation |
| --- | --- | --- |
| Dependencies | Explicit npm deprecation at a proven exact version | Medium band when any supported declaration is deprecated |
| Security | Active exact-version OSV matches with validated CVSS base severity | Worst supported applicable severity; aliases deduplicated |
| Maintainability | Declared lint and applicable type-check safeguards | Equal weight per package check |
| Testing | Declared test execution and matching test-file presence | Equal weight per package check |
| Tooling | Shared exact npm/pnpm/Yarn pin and matching workspace lockfile | Shared repository checks counted once |

Risk bands: none 100, low 90, medium 70, high 40, critical 0. These are versioned product
bands, not percentages of safety. One or twenty packages in the same band have the same score;
affected package/advisory counts retain the difference. Updates, migrations, overlap and non-use
advice remain visible with no numeric effect. Expo advice requires SDK compatibility review.

Readiness = 100 × passed / applicable. Applicable checks have equal weight. Unknown required
checks block the number. Not-applicable checks are displayed and omitted from its denominator.
Ordinary JavaScript does not require TypeScript. An orchestration-only root does not duplicate
member readiness; source-owning packages and packages with their own suites have separate checks.

Overall = min(mean of applicable categories, applicable Dependencies, applicable Security).
Any required unknown category blocks overall; no applicable categories yields not_applicable.
The UI may round numbers for display but never recomputes a category or ceiling.

## Evidence and uncertainty

JS-INSPECTION-018@1 emits pass/fail/unknown/not_applicable checks with stable package-scoped IDs.
Unknown checks reference limitations. Only the precise evidence required by a check blocks it:
missing npm latest does not block a complete current-version deprecation record; an opaque ESLint
preset need not block evidence that a lint configuration exists. Partial source usage still blocks
absence-based non-use findings. Incomplete workspace discovery blocks potentially omitted checks.

OSV needs complete exact-version query provenance and affected npm identity. Withdrawn records
are excluded. Missing, malformed or unsupported CVSS severity stays unknown; CVSS 2/3/3.1/4 base
vectors are validated by a pure adapter. Severity is not evidence of runtime exploitability and
complete zero-match queries do not prove universal security. Transitive auditing is outside scope.

Runner discovery never executes scripts. Bounded npm/pnpm/Yarn/Turbo delegation reaches actual
declared member runners. Unsupported selectors, dynamic shell syntax, selection overrides or
custom conventions remain unknown. passWithNoTests does not prove test-file presence. Literal
Vitest/Jest/Playwright selection settings are used where supported; opaque unrelated coverage or
browser defaults do not invalidate known file-selection fields.

## Report compatibility

New writers emit schema 2.0.0, including named checks, scope, counts, rationale, risk-band/readiness/
overall explanations and structured limitation reasons. There is no evidenceCoverage field.
The independent strict schema 1.0.0 reader preserves historical v1/v2 scoring values unchanged.
legacyStackHealthScorer is retained for regression reference only; readers never rescore reports.
Numeric zero, unknown and not-applicable are distinct. Duplicate IDs, dangling links and dishonest
check counts fail report validation.

Deploy readers accepting both schemas before writers, then restart API and Worker together.
Rollback must retain v2 read support. Existing JSONB rows need no migration or backfill.

## Verification

See [phase reviews and acceptance](workspace-inspection.md). Deterministic fixtures cover bands,
duplication, monotonic severity, missing evidence, setup applicability, risk ceilings, pinned
repository conventions, and persistence/API compatibility. Live provider runs are supplementary.
