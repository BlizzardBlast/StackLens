# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-19  
> **Baseline branch:** `main`  
> **Baseline verification:** Resolve the current `main` HEAD and confirm its quality workflow is green before changing code.  
> **Architecture:** v0.1.6  
> **Completed milestone:** OSV vulnerability-data adapter — PR #14  
> **Immediate milestone:** Milestone D — Known-vulnerability finding rule  
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
- bounded exact-version OSV vulnerability acquisition in `@stacklens/data-sources`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.

The latest completed product implementation milestone is the **OSV vulnerability-data adapter** slice. The deterministic analyzer core remains the latest analyzer architecture milestone.

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

The npm Registry and OSV adapters are implemented. No GitHub acquisition adapter, worker, web application, provider-backed dependency finding rule, concrete priority policy, or concrete scoring policy has been implemented yet.

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

## 7. Completed milestone: OSV vulnerability-data adapter

The second external provider boundary is implemented in `packages/data-sources` by PR #14.

Accepted implementation:

- `OsvVulnerabilityAdapter` is the only OSV network boundary;
- only exact npm semantic versions are accepted for OSV queries;
- ranges/tags/short versions such as `^1.2.3`, `latest`, and `1.2` are rejected before network
  access rather than being treated as installed versions;
- equivalent package/version queries are deduplicated and sorted deterministically;
- OSV `/v1/querybatch` is used for exact package/version matching;
- per-query pagination is followed within a configurable safety bound;
- every normalized query records whether its result is complete;
- unique matched advisory IDs are resolved through OSV's fixed `/v1/vulns/{id}` endpoint;
- advisory metadata preserves IDs, modified/published/withdrawn timestamps, aliases/related/upstream
  IDs, top-level/per-package severity records, affected package/version metadata, and validated
  HTTP(S) references;
- severity is source metadata only; the adapter does not derive qualitative severity or score impact;
- `ExternalEvidence` links are generated only from the known `osv.dev/vulnerability/` origin;
- a detail failure preserves the authoritative exact-version batch match and turns the source
  partial rather than erasing evidence;
- pagination/provider/schema failures are typed source failures;
- an empty complete OSV result is not described as proof that a dependency is secure;
- no JavaScript rule performs provider I/O;
- PR tests are synthetic and have no live-network dependency.

The npm and OSV adapters share the bounded response-reader and npm package-name validation helpers.

Primary traceability:

`FR-011, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-002, GOV-006, GOV-007`.

## 8. Immediate next milestone: Known-vulnerability finding rule

Implement the first provider-backed JavaScript/TypeScript finding vertical slice for **FR-011**.

Keep acquisition separate: rules consume an already-normalized OSV snapshot through analyzer metadata
and remain synchronous.

Required behavior:

- an exact package/version OSV batch match may establish a factual known-vulnerability candidate;
- every emitted finding must identify the package and OSV advisory/vulnerability reference;
- severity may be surfaced only when it is present in normalized OSV metadata and must remain
  attributed to the source;
- a withdrawn advisory must not be silently treated as an active vulnerability without an explicit
  accepted rule for doing so;
- incomplete OSV query results or unavailable provider data must produce limitation/insufficient
  evidence behavior rather than a clean/secure conclusion;
- an empty **complete** query result means only that OSV returned no matching known vulnerability for
  that exact evidence; do not emit a "secure" fact/finding;
- keep detection separate from priority, recommendations, and scoring;
- do not add npm outdated/deprecation/health findings in the same PR.

### Milestone E — npm metadata dependency findings

After the FR-011 vertical slice, implement focused JS/TS rules for:

- FR-006 outdated;
- FR-007 explicit deprecation/unmaintained heuristics;
- FR-010 health signals.

Keep authoritative facts separate from heuristics.

Do not implement a generic "unmaintained" claim without explicit deterministic evidence and confidence.

### Milestone F — Overlap plus framework/tool/configuration detection

Implement:

- FR-008 overlapping/redundant dependency cases;
- FR-012 framework/tool detection;
- FR-013 project configuration detection.

Static inspection only.

Dynamic JavaScript configuration is text/AST-inspected and marked partial when it cannot be safely
resolved.

Never import/execute project configuration.

### Milestone G — Repository acquisition

Implement public GitHub repository acquisition for **FR-003** using the already accepted
worker/static-snapshot architecture.

Required properties:

- resolve immutable commit SHA;
- fetch bounded static files only;
- skip/limit binary/generated/vendor content;
- treat symlinks/submodules as metadata unless later requirements say otherwise;
- record skipped/unsupported content as limitations;
- never clone-and-run the project.

This milestone enables stronger evidence for **FR-009**.

### Milestone H — Static source usage analysis

Implement supported static detection for FR-009:

- ESM static imports/exports;
- CommonJS `require("...")`;
- dynamic `import()` with static string;
- supported config/plugin references;
- package scripts/framework conventions where deterministic.

Do not declare a package unnecessary merely because a basic import scan did not find it.

Quick manifest analysis must explicitly state that source-level necessity is unavailable.

### Milestone I — Migration opportunities, recommendations, priority, scoring

Once factual/finding coverage is meaningful, implement:

- FR-014 migration opportunities;
- FR-015 recommendations;
- FR-016 priority policy;
- FR-018 overall score;
- FR-019 category scores;
- FR-020 score explanations;
- FR-021 limitations.

Create concrete `packages/scoring` only when score behavior can be based on accepted evidence
coverage and rules.

All score contributions must be explainable and versioned.

Missing evidence must yield N/A/insufficient-evidence, not penalties.

### Milestone J — Product web/API/worker completion

After the analysis domain is proven in vertical slices, finish:

- React/Vite web app;
- Fastify REST/OpenAPI API;
- Graphile Worker repository jobs;
- PostgreSQL job/report state;
- progress visibility;
- Design v1 implementation;
- accessibility/responsiveness.

Do not move analyzer logic into React or Fastify.

## 9. What not to do next

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

## 10. Pull-request strategy for the next session

Recommended next PR:

**Title**

```text
feat: add known vulnerability rule
```

**Primary requirements**

```text
FR-011,
DATA-001, DATA-002, DATA-003, DATA-005,
NFR-001, NFR-002, NFR-003, NFR-004,
SEC-002,
GOV-002, GOV-006, GOV-007
```

Keep the PR limited to a synchronous provider-backed FR-011 rule slice, the normalized metadata
shape needed by that rule, focused positive/negative/insufficient-evidence fixtures, analyzer-core
integration, and documentation.

Do not add provider I/O to JavaScript rules. Do not add scoring, recommendations, npm outdated
findings, or Fastify transport in the same PR.

## 11. Handover completion signal

The next session can consider the FR-011 finding slice complete when:

1. the rule consumes normalized OSV metadata without network I/O;
2. exact package/version advisory matches can produce factual finding candidates with stable rule
   identity and evidence references;
3. severity is surfaced only when supplied by OSV and remains source-attributed;
4. withdrawn, incomplete, unavailable, and empty-result cases have explicit conservative behavior;
5. no missing/empty evidence path produces a "secure" finding;
6. detection remains separate from priority, recommendations, and scoring;
7. focused rule/analyzer integration tests are green;
8. the same PR completes journey/handover documentation before merge and the permanent CI gate is
   green.

Continue with the smallest provider-backed vertical slice rather than combining vulnerability,
outdated/deprecation, and scoring behavior.
