# @stacklens/scoring

Concrete deterministic StackLens scoring policy.

## Responsibility

This package implements the `AnalysisScorer` dependency-inversion boundary owned by `@stacklens/analyzer-core`.

Current production policy:

- scorer version: `stack-health-v1`;
- contribution rule: `SCORE-STACK-001@1`;
- numeric categories: Dependencies and Security when explicit coverage facts exist;
- N/A categories: Maintainability, Testing, Tooling until accepted coverage policy exists;
- deductions by finalized finding priority: critical 40, high 25, medium 12, low 5;
- overall score: mean of available Dependencies + Security only when both are available;
- missing evidence: N/A, never an automatic deduction.

The package contains no ecosystem detection, provider I/O, UI logic, or LLM scoring.

See [Scoring Policy v1](../../docs/implementation/scoring.md) and **ADR-0011**.

**Traceability:** FR-018–FR-021, SCORE-001–SCORE-004, NFR-001, NFR-004, NFR-005.
