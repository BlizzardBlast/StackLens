# @stacklens/analyzer-core

Deterministic orchestration for StackLens analysis rules.

## Responsibility

This package owns:
- immutable analysis context boundaries;
- rule interfaces;
- fact → finding → recommendation stage orchestration;
- deterministic rule ordering;
- rule-output ownership validation;
- graceful isolation of individual rule failures;
- scoring dependency inversion;
- Analysis Report assembly through `@stacklens/contracts`.

It does **not** own:
- JavaScript/TypeScript-specific detection rules;
- npm/OSV/GitHub network adapters;
- priority formulas outside the rule that emits a finding;
- score calculations;
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
             findings
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

Rules in the same stage are isolated from sibling outputs. Rules run in stable ID order, while each later stage receives the completed prior-stage output.

This prevents accidental rule-order coupling and supports **NFR-001** and **NFR-002**.

## Rule safety

Rule evaluation is synchronous by contract. Network access and other external I/O happen before the rule pipeline through explicit provider adapters.

A rule must:
- have a stable non-empty ID and version;
- declare at least one accepted requirement ID;
- emit only its own contract entity type;
- use its own rule ID/version on emitted facts/findings/recommendations;
- emit only requirement IDs declared by the rule;
- include its own rule ID on limitations it creates.

If a rule throws or emits invalid output, analyzer-core omits that rule's outputs and creates a deterministic rule partial-failure + limitation. Other rules continue (**NFR-003**).

Duplicate rule IDs are an invalid analyzer configuration and fail before evaluation.

## Scoring boundary

`AnalysisScorer` is an interface only. `@stacklens/analyzer-core` does not implement score formulas.

The future `packages/scoring` package will implement this interface and receive readonly:
- sources;
- evidence;
- facts;
- findings;
- limitations;
- partial failures.

This follows dependency inversion: analyzer-core depends on the scoring abstraction, not a scoring implementation.

## Determinism

Analyzer-core does not create current timestamps, random IDs, or network requests.

Callers supply:
- analysis ID;
- analysis timestamp;
- normalized input;
- project snapshot;
- metadata snapshot;
- evidence/source records.

Given equivalent inputs, rule set, scorer version/implementation, and analyzer version, the core produces equivalent report data.

## Traceability

**PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002.**
