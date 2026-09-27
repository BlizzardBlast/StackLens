# @stacklens/scoring

Concrete deterministic StackLens scoring policy.

## Responsibility

This package implements the `AnalysisScorer` dependency-inversion boundary owned by `@stacklens/analyzer-core`.

Current production policy:

- scorer version: `stack-health-v2`;
- contribution rule: `SCORE-STACK-001@2`;
- numeric categories: Dependencies, Security, Maintainability, Testing, and Tooling when their
  explicit scope coverage facts exist and no material scored-rule limitation blocks them;
- scopes: version health, known advisories, major migration readiness, static test setup, and
  package-manager/lockfile reproducibility (ADR-0012);
- deductions by finalized finding priority: critical 40, high 25, medium 12, low 5;
- overall score: equal-weight mean of all five categories only when all five are available;
- missing evidence: N/A, never an automatic deduction.

The package contains no ecosystem detection, provider I/O, UI logic, or LLM scoring.

Stored v1 reports retain their values. Scoring eligibility is not measured repository coverage.

See [Scoring Policy v2](../../docs/implementation/scoring.md) and **ADR-0012**.

**Traceability:** FR-018–FR-021, SCORE-001–SCORE-004, NFR-001, NFR-004, NFR-005.
