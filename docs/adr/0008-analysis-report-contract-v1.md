# ADR-0008: Analysis report contract v1

- **Status:** Accepted
- **Date:** 2026-09-19
- **Requirements:** FR-015–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-006, GOV-007
- **Related:** ADR-0001, ADR-0007

## Context

StackLens now has production design infrastructure but no authoritative shared analysis-domain contract.

The web UI, future analyzer core, API, worker, CLI, GitHub integration, and IDE integration must not invent parallel representations of findings, evidence, limitations, or scores.

The model must also make several accepted requirements structurally difficult to violate:

- facts and recommendations remain separate (**DATA-005**);
- heuristic conclusions expose confidence and supporting facts (**DATA-004**);
- external evidence exposes provenance and time context (**DATA-001**, **DATA-002**);
- missing evidence is represented explicitly rather than as a low score (**SCORE-003**);
- score contributions remain explainable (**SCORE-002**);
- report references remain stable and machine-consumable (**NFR-005**).

## Decision

Create `@stacklens/contracts` as a framework-agnostic Zod 4 package.

The package owns runtime-validatable serialized domain shapes and cross-entity invariants. It does not perform analysis, scoring, persistence, networking, or rendering.

### Domain flow

The v1 contract separates:

```text
evidence
  ↓
facts
  ↓
findings
  ↓
recommendations

facts/findings/evidence
  ↓
score contributions
  ↓
scores
```

### Evidence

Evidence represents where an observation came from.

Project evidence identifies a safe project location without embedding arbitrary source excerpts.

External evidence references a report-level data source. Available/partial data sources carry `retrievedAt`; unavailable sources carry `attemptedAt`.

External evidence cannot reference a source whose status is `unavailable`.

### Facts

Facts are normalized deterministic observations. They carry:
- stable ID;
- fact type;
- subject;
- human-readable statement;
- rule identity/version;
- requirement IDs;
- evidence references.

Facts are not recommendations.

### Findings

Findings are attention-worthy analyzer conclusions and have exactly two classifications:

- `fact`;
- `heuristic`.

Recommendations are **not** a finding classification.

Every finding carries a deterministic priority object. Heuristic findings additionally require confidence with a rationale and supporting fact IDs.

### Recommendations

Recommendations are separate domain entities.

A recommendation references one or more findings and evidence records. A fact-based recommendation may reference only factual findings. A heuristic recommendation must include confidence and reference at least one heuristic finding.

This enforces **DATA-005** in the serialized model.

### Scores

A score is a discriminated union:

- `available` — carries a numeric 0–100 value, evidence coverage, and score-contribution references;
- `insufficient_evidence` — carries evidence coverage and one or more limitation references.

A numeric score of `0` is therefore distinct from N/A.

Score contributions have a direction and positive point magnitude and must reference evidence plus at least one fact or finding.

### Report

`AnalysisReport` v1 includes:

- schema version;
- analysis identity and creation time;
- normalized input identity/fingerprint;
- analyzer/rule-set/scoring versions;
- data-source observations;
- evidence;
- facts;
- findings;
- recommendations;
- overall/category scores and contribution ledger;
- limitations;
- partial failures.

The report schema performs cross-reference and duplicate-ID validation.

## Schema version

The initial serialized report schema version is:

`1.0.0`

This version is independent from application/package versions.

Breaking serialized-contract changes require:
1. a report schema-version change;
2. ADR/architecture review;
3. compatibility/migration consideration for stored reports and future external consumers.

## React/UI boundary

React components consume contract types but do not own them.

For example, `FindingCard` accepts classification, priority, confidence, category, and rule vocabulary from `@stacklens/contracts` through type-only imports.

React components remain presentation-focused and must not calculate priority, confidence, recommendations, or scores.

## Consequences

### Positive

- one authoritative domain vocabulary;
- runtime validation at trust boundaries;
- compile-time reuse across TypeScript consumers;
- explicit fact/recommendation separation;
- explicit N/A semantics;
- stable basis for analyzer, API, persistence, CLI, and UI work;
- React components remain presentational rather than becoming domain-model owners.

### Negative

- cross-reference validation adds contract complexity;
- serialized changes now require deliberate versioning;
- ecosystem-specific detail must be represented through stable generic subjects/evidence rather than leaking parser/provider structures into the public report.

These costs are accepted because contract stability is a core StackLens product requirement.
