# Analyzer Core

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002, GOV-007
> **Decision:** ADR-0009

## Package responsibility

`packages/analyzer-core` orchestrates deterministic analysis but does not contain ecosystem-specific rules, priority policy, or score policy.

It owns:
- immutable context interfaces;
- shared rule-definition metadata;
- rule interfaces;
- finding-candidate types;
- prioritizer interface/orchestration;
- deterministic stage execution;
- output/reference validation;
- failure isolation;
- scoring abstraction;
- report assembly.

It does not own:
- npm/OSV/GitHub requests;
- JavaScript/TypeScript parsing rules;
- priority formulas;
- scoring formulas;
- database/job state;
- API/React code.

## Package layout

```text
src/
├─ context.ts          # DeepReadonly analysis context + stage visibility
├─ rule-definition.ts  # stable ID/version/requirement metadata
├─ rules.ts            # fact/finding/recommendation interfaces + validation
├─ priority.ts         # finding candidates + prioritizer abstraction
├─ pipeline.ts         # staged execution/reference validation/failure isolation
├─ scoring.ts          # AnalysisScorer dependency-inversion boundary
├─ report.ts           # contract-validated AnalysisReport assembly
├─ analyzer.ts         # top-level orchestration/config validation
├─ errors.ts           # configuration/invariant errors
└─ index.ts            # explicit public surface
```

No generic `utils.ts` or catch-all `types.ts` module is used.

## Context boundary

The caller supplies:
- `AnalysisInput`;
- normalized project snapshot;
- normalized metadata snapshot;
- source observations;
- evidence;
- pre-existing limitations/partial failures.

Project and metadata snapshots stay generic so ecosystem packages can provide strongly typed normalized snapshots without leaking JS/TS concepts into analyzer-core.

Rules see those generic snapshots through `DeepReadonly<T>`.

## Deterministic stages

### 1. Fact rules

Fact rules receive normalized context and emit facts plus optional limitations.

Same-stage fact rules cannot see sibling facts.

### 2. Finding rules

Finding rules receive the completed fact set and emit **finding candidates** without priority.

A finding candidate is the accepted public Finding shape minus `priority`.

The candidate is runtime-validated against the corresponding factual/heuristic finding schema with `priority` omitted. Extra priority data is rejected.

### 3. Priority

The versioned rule set contains one `FindingPrioritizer`.

The prioritizer receives:
- completed facts;
- all validated finding candidates;
- prior-stage limitations/partial failures;
- normalized project/metadata/source/evidence context.

For each candidate it returns `FindingPriority`.

Analyzer-core verifies that the priority's rule ID/version belongs to the configured prioritizer. A failure affects only that candidate; other candidates continue.

### 4. Recommendation rules

Recommendation rules receive completed facts plus successfully finalized findings.

They cannot see sibling recommendation output.

### 5. Scoring

`AnalysisScorer` receives finalized findings and the completed evidence/failure state.

Analyzer-core invokes it after recommendation execution. The scorer remains policy-free from analyzer-core's perspective.

## Stable ordering

Fact/finding/recommendation rules are sorted by stable rule ID using plain code-unit ordering.

Registration order therefore does not alter execution or result ordering.

## Output/reference validation

Analyzer-core validates more than individual schemas.

A rule result is isolated as invalid when it:
- violates its contract schema;
- claims another rule's identity/version;
- cites requirements the rule did not declare;
- duplicates an already-emitted entity ID;
- references unknown evidence;
- references facts/limitations not available to its stage;
- emits a recommendation whose basis contradicts its referenced findings.

Finding rules also cannot embed priority.

These checks happen before final report assembly so one bad rule does not corrupt an otherwise valid analysis.

## Failure model

Rule failures and priority failures generate deterministic rule-scoped:
- `PartialFailure`;
- `partial_failure` limitation.

Original thrown exception text is not copied into the public report.

Generated failure identifiers are collision-safe within existing limitation/failure collections while staying inside contract length limits.

Invalid analyzer configuration—such as duplicate rule IDs, invalid versions, or missing requirement declarations—fails before rule evaluation.

## Scoring

`AnalysisScorer` is synchronous and deterministic by contract.

The scorer version is copied into `AnalysisReport.analyzer.scoringVersion`.

Milestone I now supplies the first concrete implementation in `packages/scoring` as
`stack-health-v1`. Analyzer-core still never chooses score weights, bands, deductions, supported
categories, or evidence-coverage rules; those remain policy owned outside this package under ADR-0011.

## Report assembly

`assembleAnalysisReport` builds the public v1 report and validates it through `AnalysisReportSchema`.

This remains the final integrity boundary before a report leaves analyzer-core.

## Testing strategy

Tests cover:
- code-unit rule ordering;
- prior-stage visibility;
- finding-candidate → priority → public-finding transition;
- exception isolation;
- invalid schema/ownership/reference isolation;
- priority failure isolation;
- duplicate rule/prioritizer rejection;
- requirement traceability;
- analyzer/scorer configuration validation;
- scorer dependency inversion;
- caller ownership of timestamps/IDs;
- full report-schema validation.

Rule packages added later should test domain behavior directly against normalized fixtures.

## First ecosystem consumer

`packages/rules-javascript` is now the first ecosystem-specific consumer of analyzer-core.

Its FR-005 integration fixture proves:
- normalized `package.json` declarations enter as the project snapshot;
- local project evidence is supplied before analyzer execution;
- `JS-DEP-005@1` emits facts only;
- the prioritizer is not invoked because no finding candidates exist;
- score output remains explicit insufficient evidence rather than manufacturing a perfect score.

Registry/network metadata remains outside both analyzer-core and the rule package.


## Milestone I policy integration

The production JavaScript/TypeScript analyzer can now compose the existing core with:

- `JS-MIGRATION-014@1` finding detection;
- `JS-PRIORITY-016@1` finding prioritization;
- `JS-RECOMMEND-015@1` recommendation generation;
- `JS-COVERAGE-018@1` category coverage facts/limitations;
- `stackHealthScorer` (`stack-health-v1`) from `@stacklens/scoring`.

This confirms the dependency-inversion design: analyzer-core required no priority/scoring formula change for production policy to become concrete.
