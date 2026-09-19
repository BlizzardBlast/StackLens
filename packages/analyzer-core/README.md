# @stacklens/analyzer-core

Deterministic orchestration for StackLens analysis rules.

## Responsibility

This package owns:
- deeply readonly analysis-context boundaries;
- fact, finding-candidate, priority, and recommendation interfaces;
- deterministic staged execution;
- rule/output/reference validation;
- graceful isolation of individual rule and priority failures;
- scoring dependency inversion;
- Analysis Report assembly through `@stacklens/contracts`.

It does **not** own:
- JavaScript/TypeScript-specific detection rules;
- npm/OSV/GitHub network adapters;
- priority formulas;
- score formulas;
- persistence;
- API/job concerns;
- React/UI behavior.

## Pipeline

```text
normalized project + metadata + evidence
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

facts + findings + evidence + limitations
                ↓
      AnalysisScorer interface
                ↓
              scores
                ↓
      AnalysisReport assembly
```

Rules in the same stage are isolated from sibling outputs. Fact/finding/recommendation rules run in stable code-unit ID order. Later stages receive only completed earlier-stage output.

The prioritizer receives the complete fact set plus all validated finding candidates and returns only `FindingPriority`. Finding rules cannot provide priority themselves.

## Rule safety

Rule and prioritizer evaluation are synchronous by contract. Network access and other external I/O happen before the pipeline through explicit provider adapters.

Every rule-stage component must:
- have a stable non-empty ID and version;
- declare at least one accepted requirement ID;
- emit only its responsibility's contract shape;
- use its own rule ID/version where the output has rule ownership;
- emit only requirement IDs declared by the rule;
- include its own rule ID on limitations it creates.

Analyzer-core validates:
- contract schemas;
- output ownership;
- requirement ownership;
- duplicate entity IDs;
- evidence/fact/limitation/finding references;
- recommendation basis vs finding classification;
- priority ownership.

If an individual rule throws or emits invalid output, its outputs are omitted and a rule-scoped partial failure + limitation is recorded. Other work continues (**NFR-003**).

If priority evaluation fails for one candidate, only that finding is omitted. Recommendation rules receive only successfully finalized findings.

Duplicate rule IDs—including the prioritizer ID—are invalid configuration and fail before any rule evaluates.

## Priority boundary

`FindingPrioritizer` is an interface only. Analyzer-core does not implement priority policy.

It belongs to the versioned rule set so a priority-policy change requires an intentional rule-set version change for reproducibility.

The prioritizer receives readonly:
- normalized project/metadata context;
- sources/evidence;
- limitations/partial failures from prior stages;
- all completed facts;
- all validated finding candidates.

It returns a contract `FindingPriority` for one candidate at a time.

## Scoring boundary

`AnalysisScorer` is also an interface only. Analyzer-core does not implement score formulas.

The future `packages/scoring` package will implement this interface and receive readonly:
- sources;
- evidence;
- facts;
- finalized findings;
- limitations;
- partial failures.

This follows dependency inversion: analyzer-core depends on scoring and priority abstractions, not their policy implementations.

## Determinism

Analyzer-core does not create current timestamps, random IDs, or network requests.

Callers supply:
- analysis ID;
- analysis timestamp;
- normalized input;
- project snapshot;
- metadata snapshot;
- evidence/source records.

Project and metadata snapshots are exposed to rules through a recursive `DeepReadonly` type.

Generated failure IDs are deterministic and collision-safe within the existing report collections.

Given equivalent inputs, rule set, prioritizer, scorer, and analyzer versions/implementations, the core produces equivalent report data.

## Traceability

**PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002.**
