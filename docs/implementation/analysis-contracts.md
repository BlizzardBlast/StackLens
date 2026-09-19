# Analysis Contracts v1

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-015–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-007
> **Decision:** ADR-0008

## Package

`packages/contracts` contains StackLens's runtime-validatable public analysis-domain contracts.

It is intentionally independent from:
- React;
- Fastify;
- PostgreSQL;
- Graphile Worker;
- GitHub/npm/OSV HTTP clients;
- analyzer implementations.

Zod is the only runtime dependency.

## Module responsibilities

```text
src/
├─ identifiers.ts      # stable identifiers and rule references
├─ category.ts         # shared scoring/report categories
├─ time.ts             # serialized timestamps
├─ subject.ts          # analysis subjects
├─ input.ts            # manifest/repository analysis identity
├─ evidence.ts         # project/external provenance
├─ fact.ts             # normalized observations + structured fact details
├─ finding.ts          # factual/heuristic conclusions + priority
├─ recommendation.ts   # separate actionable advice
├─ limitation.ts       # limitations + typed partial failures
├─ score.ts            # score states + contribution ledger
├─ analysis-report.ts  # versioned aggregate + cross-reference validation
└─ index.ts            # explicit public package surface
```

Each module owns one domain responsibility. The package avoids generic `utils.ts` or catch-all `types.ts` modules.

## Runtime validation

Consumers validate untrusted serialized reports with:

```ts
import { AnalysisReportSchema } from "@stacklens/contracts";

const result = AnalysisReportSchema.safeParse(input);
```

The aggregate schema validates:
- duplicate entity IDs;
- source references;
- evidence references;
- fact/finding/recommendation references;
- limitation references;
- score-contribution references;
- external evidence against unavailable data sources;
- heuristic confidence support;
- factual vs heuristic recommendation consistency.

## TypeScript use

Consumers should import the narrowest contract surface practical.

Example:

```ts
import type {
  ConfidenceLevel,
  FindingClassification,
  PriorityLevel
} from "@stacklens/contracts/finding";
```

UI components should prefer type-only imports when runtime schema validation is not needed.

## React boundary

`@stacklens/ui` depends on `@stacklens/contracts` for shared domain vocabulary.

React components:
- receive domain semantics as props;
- render them accessibly;
- do not decide whether a finding is factual/heuristic;
- do not compute priority/confidence;
- do not calculate score bands or score values;
- do not convert findings into recommendations.

This preserves separation of concerns and keeps analyzer/scoring behavior outside presentation code.

## Testing

Contract tests cover:
- valid report parsing;
- zero score vs insufficient evidence;
- heuristic-confidence requirements;
- factual findings rejecting heuristic confidence;
- score-contribution explainability;
- unknown references;
- duplicate IDs;
- invalid source ranges;
- contradictory external-source states.

Future contract changes should add both positive and invalid-state tests.

## Structured dependency inventory

FR-005 requires dependency name, declared version/range, and dependency group to remain
machine-readable.

The v1 fact contract therefore supports optional dependency-inventory `details` with:
- `kind: "dependency_inventory"`;
- `dependencyGroup`;
- `declaredSpecifier`.

The generic fact subject continues to carry the dependency name. `declaredSpecifier` deliberately
uses neutral terminology because valid declarations can be exact versions, ranges, tags, workspace
references, file references, or URLs.

The extension is optional and existing reports without `details` remain valid, so the report
schema version stays `1.0.0`.

## Dependency version

The implementation pins mature Zod `4.4.3` rather than adopting a just-published release during this milestone. Dependency updates remain subject to the repository's pnpm supply-chain policy.

## Current consumers

`packages/analyzer-core` consumes these contracts for deterministic orchestration.

`packages/rules-javascript` now consumes the fact/evidence contracts for the FR-005 dependency
inventory slice. Ecosystem packages must continue to reuse these public shapes rather than define
parallel report entities.
