# @stacklens/contracts

Runtime-validatable StackLens domain contracts.

## Responsibility

This package defines the stable structured language shared by the analyzer, API, worker, web UI, and future CLI/GitHub/IDE integrations.

It owns **shape and invariants**, not analysis decisions.

The package does not:
- detect dependencies;
- decide finding priority;
- calculate scores;
- assign confidence;
- create recommendations;
- perform network or persistence work;
- contain React components.

Those responsibilities belong to later analyzer/scoring/application layers.

## Domain flow

```text
evidence
  ↓
facts
  ↓
findings
  ↓
recommendations

findings/facts/evidence
  ↓
score contributions
  ↓
scores
```

This separation protects **DATA-005**: advice is not represented as observed fact.

## Analysis report v1

`AnalysisReportSchema` currently requires:

- schema/reproducibility metadata;
- normalized input identity;
- external data-source observations;
- project/external evidence;
- normalized facts;
- factual or heuristic findings;
- separate recommendations;
- explainable scores;
- limitations;
- partial failures.

Report-level validation also checks reference integrity and duplicate IDs.

## Important invariants

- Heuristic findings require confidence and supporting fact IDs (**DATA-004**).
- Factual findings cannot carry heuristic confidence.
- Recommendations are separate from findings (**DATA-005**).
- External evidence must reference a known source (**DATA-001**, **DATA-002**).
- Available scores use 0–100 values and explicit contribution IDs.
- Insufficient-evidence scores use `status: "insufficient_evidence"` with limitation IDs; they never encode N/A as zero (**SCORE-003**).
- Score contributions reference evidence plus at least one fact or finding (**SCORE-002**).
- Report references must resolve to entities contained in the same report (**NFR-005**).

## Versioning

`ANALYSIS_REPORT_SCHEMA_VERSION` is independent from the application package version.

Breaking changes to the serialized report shape require a schema-version change and corresponding architecture/ADR review.

**Traceability:** FR-015–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005.
