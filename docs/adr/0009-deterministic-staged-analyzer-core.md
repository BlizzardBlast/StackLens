# ADR-0009: Deterministic staged analyzer core

- **Status:** Accepted
- **Date:** 2026-09-19
- **Requirements:** PRD-001–PRD-004, FR-015–FR-021, DATA-003–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, SEC-001–SEC-002, GOV-006, GOV-007
- **Related:** ADR-0001, ADR-0003, ADR-0008

## Context

StackLens has a versioned analysis report contract, but it still needs a reusable execution layer for deterministic analyzer rules.

The analyzer core must:
- remain ecosystem-agnostic;
- keep network/provider I/O outside rules;
- allow individual rules to be tested in isolation;
- prevent same-stage rules from quietly depending on execution order;
- preserve fact/finding/recommendation separation;
- isolate an individual rule failure without corrupting unrelated results;
- depend on a scoring abstraction rather than a concrete scoring implementation.

## Decision

Create `@stacklens/analyzer-core` as a framework/provider-agnostic TypeScript package.

### Three deterministic rule stages

Rules are separated by output responsibility:

1. **Fact rules** receive normalized context and emit facts.
2. **Finding rules** receive normalized context plus the completed fact set and emit findings.
3. **Recommendation rules** receive normalized context plus completed facts/findings and emit recommendations.

Rules in the same stage do **not** receive sibling outputs.

This means a rule can depend only on:
- normalized caller-supplied project/metadata/evidence state;
- outputs from completed earlier stages.

This prevents hidden same-stage ordering dependencies.

### Stable execution order

Within each stage, rules are sorted by stable rule ID using plain code-unit ordering.

Rule registration order therefore does not affect output ordering.

### Synchronous rule interface

Rule evaluation is synchronous.

Rules cannot use an asynchronous contract to perform hidden network/provider I/O. Data acquisition happens before analyzer-core through explicit provider adapters.

This is a structural aid for **PRD-002**, **NFR-001**, and **SEC-001**.

### Rule ownership validation

Analyzer-core validates emitted rule output at runtime through `@stacklens/contracts`.

Facts/findings/recommendations must:
- conform to their contract schema;
- identify the currently executing rule ID/version;
- cite only requirement IDs declared by that rule.

A rule-created limitation must include that rule ID in `ruleIds`.

### Rule failure isolation

If an individual rule:
- throws;
- emits schema-invalid output;
- emits output owned by another rule; or
- violates requirement ownership,

its output is omitted and analyzer-core records:
- a deterministic rule-scoped `PartialFailure`;
- a corresponding `partial_failure` limitation.

Other rules continue.

Invalid analyzer configuration such as duplicate rule IDs fails before rule execution.

### Scoring dependency inversion

Analyzer-core defines the `AnalysisScorer` interface but does not calculate scores.

A scorer receives readonly:
- sources;
- evidence;
- facts;
- findings;
- limitations;
- partial failures.

The future `packages/scoring` package implements this interface.

This keeps score formulas and weights outside analyzer orchestration while still allowing analyzer-core to assemble a complete `AnalysisReport`.

### Caller-owned nondeterministic values

Analyzer-core does not create:
- analysis IDs;
- current timestamps;
- random identifiers;
- external metadata.

Those values are supplied by the caller.

Rule-failure timestamps use the caller-supplied analysis timestamp.

## Consequences

### Positive

- deterministic, independently testable rule execution;
- clear single-responsibility rule types;
- no hidden network I/O in rules;
- no same-stage rule coupling;
- graceful rule-level partial failure;
- scoring remains replaceable behind an interface;
- analyzer-core remains reusable by API, worker, CLI, GitHub automation, and IDE surfaces.

### Negative

- rules that conceptually want to create both a fact and a finding must be split across stages;
- rule authors must maintain stable IDs and requirement declarations;
- a full analyzer run still requires an external scoring implementation.

These constraints are intentional because they make requirements around evidence, determinism, and traceability structurally easier to preserve.
