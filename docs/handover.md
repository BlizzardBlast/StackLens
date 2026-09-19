# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-19  
> **Baseline branch:** `main`  
> **Baseline verification:** Resolve the current `main` HEAD and confirm its quality workflow is green before changing code.  
> **Architecture:** v0.1.6  
> **Completed milestone:** npm Registry package metadata adapter — PR #13  
> **Immediate milestone:** Milestone C — OSV vulnerability adapter  
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
   - `docs/implementation/rules-javascript.md`;
   - `docs/implementation/quick-manifest-analysis.md`;
   - `docs/implementation/data-sources.md`;
   - `packages/contracts/README.md`;
   - `packages/analyzer-core/README.md`;
   - `packages/rules-javascript/README.md`;
   - `packages/data-sources/README.md`;
   - `apps/api/README.md`;
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
- deterministic JavaScript dependency inventory in `@stacklens/rules-javascript`;
- framework-independent quick manifest orchestration in `apps/api`;
- bounded npm Registry metadata acquisition in `@stacklens/data-sources`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.

The latest completed product implementation milestone is the **npm Registry package metadata adapter** slice. The deterministic analyzer core remains the latest analyzer architecture milestone.

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

The first JavaScript/TypeScript product-analysis rule package is now implemented for **FR-005** only.

The API application now has a framework-independent quick-manifest service boundary, but no Fastify HTTP transport is implemented yet.

The npm Registry adapter is implemented. No OSV/GitHub adapter, worker, web application, concrete dependency finding rules beyond FR-005 inventory, concrete priority policy, or concrete scoring policy has been implemented yet.

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

## 5. Completed milestone: Quick manifest input/orchestration

The first API-application boundary is implemented in `apps/api`.

Accepted implementation:

- pasted and uploaded manifests use one authoritative service path;
- uploaded quick-analysis files must be named `package.json`;
- empty input, invalid JSON, unsupported uploads, and invalid manifest shapes return stable actionable errors;
- manifest normalization is delegated to `@stacklens/rules-javascript` rather than duplicated;
- the service creates deterministic input fingerprints without persisting raw manifest content;
- dependency project evidence is created before analyzer execution;
- analyzer-core is invoked in-process with caller-supplied analysis identity/time and an injected analyzer definition;
- quick-analysis limitations explicitly disclose unavailable source/configuration and external metadata evidence;
- no authentication, persistence, provider I/O, Fastify transport, priority policy, or production scoring formula is introduced;
- ignored manifest fields are not copied into the report, supporting minimum-retention behavior.

Primary traceability:

`FR-001, FR-002, FR-004, FR-005, FR-021, FR-022, NFR-001, NFR-004, SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007`.

## 6. Completed milestone: npm Registry package metadata adapter

The first external provider boundary is implemented in `packages/data-sources` by PR #13.

Accepted implementation:

- `NpmRegistryAdapter` is the only npm Registry network boundary;
- the adapter uses the fixed `https://registry.npmjs.org/` host and percent-encodes package names;
- full package metadata is requested so versions, dist-tags, explicit per-version deprecation,
  repository metadata, and publication timestamps can be normalized for later rules;
- response bytes and request duration are bounded;
- requested package identity must match the returned package identity;
- dist-tags must reference versions contained in the normalized response;
- malformed deprecation/timestamp/repository/version metadata fails closed instead of being coerced;
- equivalent provider objects normalize deterministically regardless object insertion order;
- successful observations produce contract-valid external source/evidence with retrieval time;
- 404/non-retryable, throttling/server/retryable, network, timeout, invalid JSON/schema, and
  over-limit failures remain typed source failures rather than empty/negative evidence;
- raw provider bodies and low-level network errors are not exposed in public failure messages;
- publisher-controlled repository URLs remain normalized metadata and are not promoted into
  `ExternalEvidence.url`; evidence links are generated only from the fixed npm Registry host;
- PR tests are synthetic and do not depend on live npm availability.

Primary traceability:

`FR-006, FR-007, FR-010, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-002, GOV-006, GOV-007`.

## 7. Immediate next milestone: OSV vulnerability adapter

Add OSV integration for **FR-011** inside `packages/data-sources`.

Keep the first OSV slice focused on provider acquisition/normalization:

- use the accepted OSV batch package/version API where practical;
- preserve OSV/advisory IDs, affected package/version evidence, severity when supplied, references,
  published/modified timestamps, and retrieval timestamp;
- exact declared versions may support direct quick-analysis queries;
- semver ranges are not installed versions and must not be queried as if they were exact;
- missing resolved/exact version evidence must remain insufficient evidence;
- an empty OSV result means no matching known vulnerability was returned for the supplied version
  evidence, not proof of security;
- provider/network/schema failures remain typed partial failures;
- keep OSV I/O outside JavaScript rules.

Do not add dependency findings, scoring, GitHub acquisition, or Fastify transport in the same PR.

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

## 8. What not to do next

Avoid these tempting detours until their requirement slice is ready:

- do not build the full dashboard before the analysis domain and provider boundaries are sufficiently complete;
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

## 9. Pull-request strategy for the next session

Recommended next PR:

**Title**

```text
feat: add OSV vulnerability adapter
```

**Primary requirements**

```text
FR-011,
DATA-001, DATA-002,
NFR-003, NFR-004,
SEC-002, SEC-008,
GOV-002, GOV-006, GOV-007
```

Keep the PR limited to explicit OSV acquisition, normalized advisory/version records,
provenance/retrieval timestamps, conservative version applicability, typed provider failures,
focused synthetic/recorded tests, and documentation.

Do not let JavaScript rules call OSV directly. Do not add vulnerability finding rules or scoring in
the same PR.

## 10. Handover completion signal

The next session can consider the OSV adapter complete when:

1. OSV access exists only behind an explicit provider adapter;
2. normalized vulnerability records preserve advisory/package/version/severity/reference timestamps
   with source provenance and retrieval time;
3. exact-version evidence is distinguished from ranges or unavailable resolved versions;
4. empty OSV results are not translated into a "secure" fact;
5. provider/network/schema failures remain typed partial failures;
6. JavaScript rules remain synchronous and provider-free;
7. focused recorded/synthetic tests are green with no live-network PR dependency;
8. the same PR finishes its own journey/handover state before merge and the permanent CI gate is
   green.

Continue with the smallest next vertical slice rather than combining provider acquisition and
vulnerability findings prematurely.
