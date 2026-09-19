# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-19  
> **Baseline branch:** `main`  
> **Baseline commit:** FR-005 merge commit (set after merge)  
> **Architecture:** v0.1.6  
> **Immediate milestone:** Milestone A — Quick manifest input/orchestration  
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

## 4. Completed milestone: FR-005 dependency inventory

The first JavaScript/TypeScript vertical slice is implemented.

Accepted implementation:

- `@stacklens/contracts` supports optional structured dependency-inventory fact details;
- existing v1 facts without details remain valid and the schema version remains `1.0.0`;
- `@stacklens/rules-javascript` validates and normalizes supported package-manifest dependency groups;
- exact declared specifier strings and dependency-group meaning are preserved;
- equivalent manifest objects normalize deterministically;
- declarations in multiple groups remain separate;
- local `ProjectEvidence` is generated deterministically without fabricated line numbers;
- `JS-DEP-005@1` emits dependency inventory facts only;
- analyzer-core integration produces a contract-valid report with explicit insufficient-evidence scores;
- no provider/network I/O or analyzed-project execution exists in the rule package.

Primary traceability:

`FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, NFR-005, SEC-001, SEC-002`.

## 5. Immediate next milestone: Quick manifest input/orchestration

The next PR should implement the smallest application/service boundary for:

- **FR-001** pasted package manifests;
- **FR-002** uploaded package manifests;
- **FR-004** input validation;
- **FR-022** anonymous quick analysis;
- **SEC-003** input/data handling requirements.

Keep the boundary thin:

1. accept manifest text/file input;
2. parse JSON safely;
3. create a stable input fingerprint;
4. call `normalizePackageManifest`;
5. create dependency inventory evidence;
6. invoke analyzer-core with the JavaScript rule set;
7. return the contract-valid report or actionable validation errors.

Do not add npm/OSV/GitHub metadata in this milestone.

Do not build the full dashboard first. A narrow service/API orchestration seam with focused tests is the priority.

## 6. Suggested implementation sequence after the quick-manifest boundary

Do not attempt all MVP requirements in one pull request.

Use small vertical slices in roughly this order.

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
feat: add quick manifest analysis boundary
```

**Primary requirements**

```text
FR-001, FR-002, FR-004, FR-022,
NFR-001, NFR-002, NFR-004,
SEC-001, SEC-002, SEC-003,
GOV-002, GOV-006, GOV-007
```

Keep the PR limited to safe manifest acquisition/parsing, validation, fingerprinting, orchestration,
focused tests, and documentation. Reuse `@stacklens/rules-javascript`; do not duplicate manifest
normalization or dependency inventory logic.

Do not bundle npm/OSV/GitHub metadata adapters or product-dashboard construction into that PR.

## 9. Handover completion signal

The next session can consider the quick-manifest boundary complete when:

1. pasted/uploaded manifest input reaches one shared safe parsing/validation boundary;
2. invalid JSON and invalid manifest shapes return actionable errors;
3. a stable manifest fingerprint is created without persisting unnecessary source data;
4. orchestration reuses `normalizePackageManifest`, FR-005 evidence creation, and analyzer-core;
5. anonymous quick analysis is supported at the service boundary;
6. no analyzed project code is executed;
7. focused tests and the permanent CI gate are green;
8. the journey and this handover advance to external package metadata adapters.

Continue with the smallest next vertical slice rather than jumping directly to the full application.
