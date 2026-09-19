# Analyzer Core

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002, GOV-007
> **Decision:** ADR-0009

## Package responsibility

`packages/analyzer-core` orchestrates deterministic analysis but does not contain ecosystem-specific product rules.

It owns:
- analysis context interfaces;
- rule definitions;
- stage execution;
- rule-output validation;
- rule failure isolation;
- scoring abstraction;
- report assembly.

It does not own:
- npm/OSV/GitHub requests;
- JavaScript/TypeScript parsing rules;
- scoring formulas;
- database/job state;
- API/React code.

## Package layout

```text
src/
├─ context.ts    # immutable rule contexts and stage visibility
├─ rules.ts      # rule interfaces + emitted-output validation
├─ pipeline.ts   # deterministic staged execution and failure isolation
├─ scoring.ts    # AnalysisScorer dependency-inversion boundary
├─ report.ts     # contract-validated AnalysisReport assembly
├─ analyzer.ts   # top-level orchestration
├─ errors.ts     # configuration/invariant errors
└─ index.ts      # explicit public surface
```

Each module has one primary responsibility. The package avoids generic utility/type dumping grounds.

## Context boundary

The caller supplies:
- `AnalysisInput`;
- normalized project snapshot;
- normalized metadata snapshot;
- source observations;
- evidence;
- pre-existing limitations/partial failures.

The project and metadata snapshot shapes remain generic so ecosystem packages can provide strongly typed normalized snapshots without putting JS/TS concepts into analyzer-core.

## Rule stages

### Fact rules

```ts
interface FactRule<Project, Metadata> {
  readonly kind: "fact";
  readonly id: string;
  readonly version: string;
  readonly requirementIds: readonly RequirementId[];
  evaluate(context: FactRuleContext<Project, Metadata>): FactRuleResult;
}
```

### Finding rules

Finding rules receive the complete fact-stage output.

They do not receive sibling finding output.

### Recommendation rules

Recommendation rules receive complete facts and complete findings.

They do not receive sibling recommendation output.

This is intentionally stricter than a mutable shared rule context.

## Output validation

Each rule's returned entities are parsed using the corresponding `@stacklens/contracts` schema.

Analyzer-core additionally validates:
- rule ownership;
- declared requirement ownership;
- limitation rule ownership.

Invalid output is handled as a failed rule, not silently normalized.

## Failure model

Individual rule failures become deterministic rule-scoped partial failures and limitations.

The original exception text is not copied into the public analysis report. The report exposes a stable generic failure message instead.

Duplicate rule IDs or missing rule requirement declarations are analyzer configuration errors and stop execution before any rule runs.

## Scoring

`AnalysisScorer` is synchronous and deterministic by contract.

Analyzer-core invokes it only after fact/finding/recommendation rule execution has completed.

The scorer version is copied into `AnalysisReport.analyzer.scoringVersion`.

Analyzer-core never chooses score weights, bands, or deductions.

## Report assembly

`assembleAnalysisReport` builds the public v1 report and validates it through `AnalysisReportSchema`.

Contract validation is the final integrity boundary before the report leaves analyzer-core.

## Testing strategy

Tests verify:
- stable ID-based rule ordering;
- stage visibility;
- exception isolation;
- invalid-output isolation;
- duplicate rule rejection;
- requirement traceability validation;
- scorer dependency inversion;
- caller ownership of timestamps/IDs;
- full report-schema validation.

Rule-package tests added later should test rule behavior directly against normalized fixtures.

## Next milestone

The next package should define the first JavaScript/TypeScript normalized project snapshot and deterministic rule package.

A narrow first vertical slice is **FR-005 dependency inventory**:
- normalize `package.json` dependency groups;
- emit evidence/facts;
- implement the first JS/TS fact rule;
- validate output through analyzer-core.

No external registry metadata is required for FR-005, making it a good first end-to-end deterministic rule.
