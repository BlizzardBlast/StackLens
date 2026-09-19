# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-19  
> **Baseline branch:** `main`  
> **Baseline commit:** `1eb0146c28f9d898b3f88ac09d2ee539f32f81e2`  
> **Architecture:** v0.1.6  
> **Immediate milestone:** FR-005 — Dependency inventory  
> **Traceability:** FR-001–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, SEC-001–SEC-008, NFR-001–NFR-009, GOV-002–GOV-007

This document is the operational handover for the next StackLens implementation session.

It is intentionally more prescriptive than the general architecture documentation. The next session should begin here, then use the linked source-of-truth documents before changing code.

## 1. Start here in the next session

Before implementing anything:

1. Confirm `main` contains this handover and is green in GitHub Actions.
2. Read, in order:
   - `docs/requirements.md`;
   - `docs/architecture.md`;
   - `docs/adr/0008-analysis-report-contract-v1.md`;
   - `docs/adr/0009-deterministic-staged-analyzer-core.md`;
   - `docs/implementation/analysis-contracts.md`;
   - `docs/implementation/analyzer-core.md`;
   - `packages/contracts/README.md`;
   - `packages/analyzer-core/README.md`;
   - `AGENTS.md`;
   - `CONTRIBUTING.md`;
   - `docs/documentation-governance.md`.
3. Work from a feature branch and pull request. Do not implement directly on `main`.
4. Put applicable requirement IDs in the implementation task, tests where practical, commit/PR context, and PR description (**GOV-002**).
5. Append a new entry to `docs/design/journey.md` in every PR (**GOV-007**).
6. Do not change product behavior through implementation alone. If a needed behavior is not covered, update the requirement first or in the same PR (**GOV-003**, **GOV-005**).

## 2. Current implementation state

The repository already has the following accepted foundations:

- canonical product/system requirements;
- architecture v0.1.6;
- Product Design v1;
- generated design-token infrastructure;
- shared UI package;
- Analysis Report Contract v1 in `@stacklens/contracts`;
- deterministic analyzer execution in `@stacklens/analyzer-core`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.

The latest completed product architecture milestone is the deterministic analyzer core.

The analyzer flow is:

```text
normalized context
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
      ↓
AnalysisScorer
      ↓
scores
      ↓
AnalysisReport
```

No JavaScript/TypeScript product-analysis rule package has been implemented yet.

No API, worker, web application, external npm/OSV/GitHub adapter, concrete priority policy, or concrete scoring policy has been implemented yet.

## 3. Non-negotiable boundaries

The next session must preserve these boundaries.

### Requirements remain authoritative

`docs/requirements.md` defines product behavior.

Do not infer new requirements from this handover, README prose, UI mocks, or implementation convenience.

### Analyzer-core stays ecosystem-agnostic

Do not put JavaScript/TypeScript package semantics into `packages/analyzer-core`.

JS/TS-specific normalization and rules belong in `packages/rules-javascript` (**NFR-004**).

### Detection, priority, recommendation, and scoring stay separate

- fact rules emit facts;
- finding rules emit finding candidates without priority;
- `FindingPrioritizer` alone creates priority;
- recommendation rules consume finalized findings;
- `AnalysisScorer` alone owns score policy.

Do not collapse these responsibilities for convenience.

### No hidden I/O in analysis rules

Rules, prioritization, and scoring are synchronous.

npm, OSV, GitHub, filesystem/repository acquisition, and other provider work must happen before the analyzer through explicit adapters.

### Never execute analyzed project code

The analyzer must not run:

- dependency installation;
- lifecycle scripts;
- package scripts;
- builds;
- tests;
- repository config modules;
- Git hooks;
- arbitrary executables.

Static parsing/inspection only (**SEC-001**, **SEC-002**).

### Missing evidence is not negative evidence

Do not infer:

- secure because OSV returned no usable data;
- unused because quick manifest input has no source files;
- unmaintained without supported evidence;
- bad score because evidence was unavailable.

Use limitations and insufficient-evidence score states (**PRD-004**, **SCORE-003**, **NFR-003**).

## 4. Immediate next milestone: FR-005 dependency inventory

The next implementation should be a narrow vertical slice for **FR-005**.

FR-005 requires the report to identify:

- dependency name;
- declared version/range;
- dependency group;
- runtime and development dependencies plus other relevant groups;
- groups without silently merging meaning.

This milestone intentionally does **not** require registry/network metadata.

### 4.1 First resolve the contract representation gap

Before writing the FR-005 rule, inspect whether Analysis Report Contract v1 can represent the required inventory in a sufficiently structured way.

At the current baseline, `AnalysisFact` contains:

- `id`;
- `type`;
- `subject`;
- `statement`;
- `rule`;
- `requirementIds`;
- `evidenceIds`.

The current generic `AnalysisSubject` contains only:

- `type`;
- `name`;
- optional `path`.

That means declared version/range and dependency group do not currently have dedicated structured fields.

**Do not satisfy FR-005 by burying required machine-readable inventory data only in a prose `statement` without first deciding whether that is acceptable for the stable API/UI contract.**

The next session should explicitly choose one of these approaches:

1. Extend the shared contract with an accepted structured dependency-inventory representation; or
2. Demonstrate that the current fact/report model already provides an adequate stable structured representation.

If the contract changes:

- keep the generic contracts package free of JS implementation logic;
- update ADR-0008 and `docs/implementation/analysis-contracts.md`;
- assess whether the serialized change is backward-compatible;
- change `ANALYSIS_REPORT_SCHEMA_VERSION` only when required by the versioning policy;
- update contract runtime tests first.

This contract decision should be the first checkpoint of the next PR.

### 4.2 Create `@stacklens/rules-javascript`

After the FR-005 representation is clear, create:

```text
packages/rules-javascript/
├─ package.json
├─ tsconfig.json
├─ tsconfig.build.json
├─ vitest.config.ts
├─ README.md
├─ src/
│  ├─ index.ts
│  ├─ manifest/
│  │  ├─ schema.ts
│  │  ├─ normalize.ts
│  │  └─ types.ts
│  └─ rules/
│     └─ dependency-inventory.ts
└─ test/
   ├─ fixtures/
   ├─ manifest-normalize.test.ts
   └─ dependency-inventory.test.ts
```

Adjust the exact file split if a smaller direct structure is clearer. Do not create generic `utils.ts` or catch-all `types.ts` modules.

Dependencies should remain minimal:

```text
@stacklens/rules-javascript
  -> @stacklens/analyzer-core
  -> @stacklens/contracts
```

Do not add database, web framework, API, React, npm registry, OSV, or GitHub dependencies to this package.

### 4.3 Define a normalized JS package-manifest snapshot

The normalized snapshot should preserve what was actually declared rather than reinterpret it.

At minimum consider:

- package name when present;
- `dependencies`;
- `devDependencies`;
- `peerDependencies`;
- `optionalDependencies`;
- relevant declaration order only if product behavior explicitly needs it.

Each dependency declaration needs:

- dependency name;
- exact declared string/range as written;
- dependency group.

Do not resolve a range to an installed version.

Do not call a range such as `^19.0.0` the installed version.

Do not merge declarations across dependency groups when doing so changes meaning (**FR-005**).

For invalid values:

- reject or surface validation failure;
- do not coerce numbers/objects to dependency strings;
- do not silently reinterpret malformed groups (**FR-004**).

Normalization must be deterministic for equivalent input.

### 4.4 Create project evidence

FR-005 uses project evidence only.

Use `ProjectEvidence` from `@stacklens/contracts`.

Evidence should identify the manifest declaration clearly.

The contract permits:

- `path: "package.json"`;
- optional line numbers when the caller actually knows them.

Do not fabricate line numbers.

Use stable deterministic evidence IDs derived from normalized declaration identity rather than random IDs.

No `DataSource` is necessary for local project evidence.

### 4.5 Implement the first fact rule

Implement a rule with a stable ID/version that traces to **FR-005**.

The rule should:

- receive the normalized manifest snapshot;
- emit one or more dependency inventory facts according to the accepted contract representation;
- cite project evidence;
- preserve dependency group and declared range information;
- avoid external I/O;
- emit no finding, recommendation, priority, or score policy.

The rule should remain independently fixture-testable (**NFR-002**).

### 4.6 Required FR-005 fixtures

At minimum test:

- runtime `dependencies`;
- `devDependencies`;
- `peerDependencies`;
- `optionalDependencies`;
- empty groups;
- manifest with multiple groups;
- same package name present in different groups;
- scoped package names;
- complex declared ranges/tags/URLs preserved exactly when supported;
- malformed dependency group;
- non-string dependency value;
- deterministic output independent of object insertion order if output order is part of the package contract.

Important acceptance case:

If a package appears in two meaningful groups, the output must not silently collapse those declarations into one ambiguous inventory item.

### 4.7 Analyzer integration fixture

After the rule works directly, add an integration fixture through `@stacklens/analyzer-core`.

The goal is to prove:

```text
normalized package.json
      ↓
project evidence
      ↓
FR-005 fact rule
      ↓
analyzer-core
      ↓
valid AnalysisReport
```

Because a full `AnalyzerDefinition` requires priority and scoring abstractions, use only a **minimal deterministic test policy** needed to assemble a valid report.

Do not prematurely define production priority weights or production score formulas in the FR-005 PR.

If there are no finding candidates yet, the prioritizer should be inert.

For scores, prefer explicit insufficient-evidence states where the product does not yet have enough implemented analysis to claim a meaningful health score. Do not manufacture a perfect score merely to satisfy the schema.

## 5. Definition of done for the FR-005 PR

Do not merge until all of the following are true:

- FR-005 representation is structurally adequate for name/range/group;
- package-manifest normalization is deterministic;
- dependency groups are preserved without silent merging;
- project evidence is explicit;
- FR-005 rule is independently tested;
- malformed inputs are not silently coerced;
- analyzer integration produces a contract-valid report;
- no network/provider I/O exists in the rule package;
- no repository code execution exists;
- requirements/architecture/contracts docs are updated if materially affected;
- `packages/rules-javascript/README.md` documents ownership/boundaries;
- `docs/design/journey.md` gets the next chronological step;
- PR description cites FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, SEC-001, SEC-002, and any additional affected IDs;
- permanent read-only CI is green.

Run the repository quality gate:

```bash
pnpm install --frozen-lockfile
pnpm check
```

GitHub Actions remains the final merge gate.

## 6. Suggested implementation sequence after FR-005

Do not attempt all MVP requirements in one pull request.

Use small vertical slices in roughly this order.

### Milestone A — Quick manifest input/orchestration

Requirements:

- FR-001;
- FR-002;
- FR-004;
- FR-022;
- SEC-003.

Build the application/service boundary needed to accept pasted/uploaded manifest input, validate it, fingerprint it, normalize it, and invoke the analyzer.

Keep UI thin and keep authoritative validation server-side when the API exists.

### Milestone B — External package metadata adapters

Create `packages/data-sources` with explicit provider adapters.

Start with npm registry data required by:

- FR-006 outdated dependencies;
- FR-007 explicit deprecation;
- FR-010 dependency-health signals.

Provider results must include provenance and retrieval timestamps (**DATA-001**, **DATA-002**).

Do not let rules call providers directly.

### Milestone C — Vulnerability adapter

Add OSV integration for **FR-011**.

Version applicability must be evidence-driven.

For quick manifest analysis:

- an exact declared version can support stronger conclusions;
- a semver range is not automatically the installed/resolved version;
- missing resolved version can mean insufficient evidence.

Never translate unavailable/no-match vulnerability data into "secure."

### Milestone D — Dependency findings

Implement focused JS/TS rules for:

- FR-006 outdated;
- FR-007 deprecated/unmaintained;
- FR-008 overlap/redundancy;
- FR-010 health signals.

Keep authoritative facts separate from heuristics.

Do not implement a generic "unmaintained" claim without explicit deterministic evidence and confidence.

### Milestone E — Framework/tool and configuration detection

Implement:

- FR-012 framework/tool detection;
- FR-013 project configuration detection.

Static inspection only.

Dynamic JavaScript configuration is text/AST-inspected and marked partial when it cannot be safely resolved.

Never import/execute project configuration.

### Milestone F — Repository acquisition

Implement public GitHub repository acquisition for **FR-003** using the already accepted worker/static-snapshot architecture.

Required properties:

- resolve immutable commit SHA;
- fetch bounded static files only;
- skip/limit binary/generated/vendor content;
- treat symlinks/submodules as metadata unless later requirements say otherwise;
- record skipped/unsupported content as limitations;
- never clone-and-run the project.

This milestone enables stronger evidence for **FR-009**.

### Milestone G — Static source usage analysis

Implement supported static detection for FR-009:

- ESM static imports/exports;
- CommonJS `require("...")`;
- dynamic import with static string;
- supported config/plugin references;
- package scripts/framework conventions where deterministic.

Do not declare a package unnecessary merely because a basic import scan did not find it.

Quick manifest analysis must explicitly state that source-level necessity is unavailable.

### Milestone H — Migration opportunities, recommendations, priority, scoring

Once factual/finding coverage is meaningful, implement:

- FR-014 migration opportunities;
- FR-015 recommendations;
- FR-016 priority policy;
- FR-018 overall score;
- FR-019 category scores;
- FR-020 score explanations;
- FR-021 limitations.

Create concrete `packages/scoring` only when score behavior can be based on accepted evidence coverage and rules.

All score contributions must be explainable and versioned.

Missing evidence must yield N/A/insufficient-evidence, not penalties.

### Milestone I — Product web/API/worker completion

After the analysis domain is proven in vertical slices, finish:

- React/Vite web app;
- Fastify REST/OpenAPI API;
- Graphile Worker repository jobs;
- PostgreSQL job/report state;
- progress visibility;
- Design v1 implementation;
- accessibility/responsiveness.

Do not move analyzer logic into React or Fastify.

## 7. What not to do next

Avoid these tempting detours until their requirement slice is ready:

- do not build the full dashboard before FR-005/domain output exists;
- do not add Next.js/TanStack Start just because they are available;
- do not introduce microservices;
- do not add Redis/BullMQ;
- do not add AI/LLM analysis;
- do not implement private GitHub repositories;
- do not create code-writing/PR automation;
- do not implement whole-repository architecture analysis;
- do not install dependencies from analyzed projects;
- do not build one giant "analyze everything" rule;
- do not add production scoring weights before evidence coverage is meaningful.

## 8. Pull-request strategy for the next session

Recommended next PR:

**Title**

```text
feat: implement JavaScript dependency inventory
```

**Primary requirements**

```text
FR-004, FR-005, FR-017,
NFR-001, NFR-002, NFR-004, NFR-005,
SEC-001, SEC-002,
GOV-002, GOV-006, GOV-007
```

If the Analysis Report contract must change, also include the relevant DATA requirements and ADR-0008 documentation impact.

Keep the PR limited to:

- contract adjustment if truly required;
- JS manifest normalization;
- FR-005 evidence/facts;
- rule fixtures/tests;
- analyzer integration fixture;
- documentation.

Do not bundle npm/OSV/GitHub/API/web work into that PR.

## 9. Handover completion signal

A future session can consider this handover's immediate goal complete when:

1. FR-005 is merged to `main`;
2. the dependency inventory is structurally represented with name/range/group;
3. the first `@stacklens/rules-javascript` package exists;
4. analyzer-core successfully consumes that package in a deterministic integration fixture;
5. the permanent CI quality gate is green;
6. the journey records the implementation and validation;
7. this handover is updated so the next active milestone is no longer FR-005.

At that point, continue with the smallest next vertical slice rather than jumping directly to full application construction.
