# ADR-0009: Deterministic staged analyzer core

- **Status:** Accepted
- **Date:** 2026-09-19
- **Requirements:** PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002, GOV-006, GOV-007
- **Related:** ADR-0001, ADR-0003, ADR-0008

## Context

StackLens has a versioned public analysis contract and needs a reusable execution layer for deterministic rules.

The core must:
- remain ecosystem-agnostic;
- keep provider/network I/O outside rule evaluation;
- support independently testable rules;
- prevent same-stage ordering dependencies;
- preserve fact/finding/recommendation separation;
- preserve the architecture's separate priority stage;
- isolate individual rule/priority failures;
- depend on priority/scoring abstractions rather than concrete policy.

## Decision

Create `@stacklens/analyzer-core` as a framework/provider-agnostic TypeScript package.

### Four deterministic analysis stages

The analyzer pipeline before scoring is:

1. **Fact rules** — normalized context → facts.
2. **Finding rules** — completed facts → finding candidates.
3. **Priority strategy** — completed facts + all finding candidates → finalized findings.
4. **Recommendation rules** — completed facts + finalized findings → recommendations.

Scoring follows those stages through a separate `AnalysisScorer` abstraction.

### Finding candidates

A finding rule does not emit a final public `Finding`.

It emits `FindingCandidate`, which is the accepted factual/heuristic finding contract without `priority`.

Analyzer-core validates candidate output using the public contract schema with the priority field omitted. Extra priority data is rejected.

This keeps **FR-016** priority policy out of finding detection logic.

### Priority dependency inversion

The versioned `AnalysisRuleSet` contains one `FindingPrioritizer`.

The prioritizer:
- has a stable rule ID/version;
- declares requirement traceability;
- is included in duplicate rule-ID validation;
- receives normalized readonly context, completed facts, and all finding candidates;
- returns only a `FindingPriority` for one candidate.

Analyzer-core validates that the returned priority identifies the configured prioritizer rule.

The priority formula itself lives outside analyzer-core.

Keeping the prioritizer inside the versioned rule set means a priority-policy change is represented by a deliberate rule-set version change, preserving **DATA-006** and **NFR-001**.

### Same-stage isolation

Fact/finding/recommendation rules in the same stage never receive sibling outputs.

Each later stage receives the completed prior-stage output.

The single prioritizer sees the complete candidate set but each candidate's priority is calculated independently from mutation of prior priority results.

### Stable execution order

Within rule stages, rules are sorted by stable rule ID using plain code-unit ordering.

Registration order does not affect output ordering.

### Synchronous evaluation

Fact/finding/recommendation rules, prioritization, and scoring are synchronous interfaces.

External I/O must be completed before analyzer-core is called. A rule cannot rely on an async contract to fetch npm/OSV/GitHub data.

This structurally supports **PRD-002**, **NFR-001**, and **SEC-001**.

### Deep-readonly context

Project and metadata snapshots are generic but exposed to rule code using recursive `DeepReadonly<T>`.

This prevents normal TypeScript rule implementations from mutating normalized analysis input.

### Runtime output and reference validation

Analyzer-core validates:
- entity contract schemas;
- rule ID/version ownership;
- rule requirement ownership;
- rule-created limitation ownership;
- duplicate emitted IDs;
- evidence references;
- fact/limitation references from findings;
- recommendation finding/evidence/confidence references;
- recommendation basis vs referenced finding classification;
- priority ownership.

Invalid output is isolated at the emitting rule/stage instead of being allowed to corrupt final report assembly.

### Failure isolation

A throwing or invalid fact/finding/recommendation rule has its entire result omitted and produces:
- a rule-scoped `PartialFailure`;
- a corresponding `partial_failure` limitation.

If prioritization fails for one candidate, only that finding is omitted. Other finding candidates still finalize, and recommendation rules see only finalized findings.

Generated failure IDs are deterministic and collision-safe within existing report collections.

Thrown exception text is not copied into the public report.

### Configuration failures

Invalid analyzer configuration stops before rule execution.

Examples:
- invalid analyzer/scorer/rule-set versions;
- duplicate rule IDs, including the prioritizer;
- empty/invalid requirement declarations.

### Scoring dependency inversion

Analyzer-core defines `AnalysisScorer` but does not calculate score policy.

A scorer receives readonly:
- sources;
- evidence;
- facts;
- finalized findings;
- limitations;
- partial failures.

`packages/scoring` implements this interface with the first production policy in ADR-0011; analyzer-core remains formula-free.

### Caller-owned nondeterministic values

Analyzer-core does not create:
- analysis IDs;
- current timestamps;
- random IDs;
- external metadata.

The caller supplies those values.

Rule/priority failure timestamps use the caller-provided analysis timestamp.

## Consequences

### Positive

- detector rules and priority policy have separate reasons to change;
- deterministic, independently testable stages;
- no hidden network I/O;
- no same-stage rule coupling;
- invalid references are isolated early;
- priority/scoring are replaceable behind interfaces;
- core remains reusable by API, worker, CLI, GitHub automation, and IDE consumers.

### Negative

- a complete analyzer definition needs both prioritizer and scorer implementations;
- rules that conceptually produce multiple domain layers must be split across stages;
- priority failure handling adds orchestration complexity;
- rule authors must maintain stable IDs and requirement declarations.

These constraints are accepted because they encode StackLens's evidence, determinism, explainability, and SOLID boundaries directly into the execution model.
