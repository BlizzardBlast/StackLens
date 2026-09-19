# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-19  
> **Baseline branch:** `main`  
> **Baseline verification:** Resolve the current `main` HEAD and confirm its quality workflow is green before changing code.  
> **Architecture:** v0.1.6  
> **Completed milestone:** overlap plus framework/tool/configuration detection — this implementation PR  
> **Immediate milestone:** Milestone G — repository acquisition  
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
- provider-backed npm outdated/deprecation/health analysis in `@stacklens/rules-javascript`;
- provider-backed factual known-vulnerability detection in `@stacklens/rules-javascript`;
- curated dependency-overlap heuristics, framework/tool facts, and static configuration inspection in
  `@stacklens/rules-javascript`;
- framework-independent quick manifest orchestration in `apps/api`;
- bounded npm Registry metadata acquisition in `@stacklens/data-sources`;
- bounded exact-version OSV vulnerability acquisition in `@stacklens/data-sources`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.

The latest completed product implementation milestone is the **FR-008/FR-012/FR-013 static project-detection** slice. The deterministic analyzer core remains the latest analyzer architecture milestone.

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

The JavaScript/TypeScript rule package now implements **FR-005 dependency inventory**, **FR-006 exact-version outdated detection**, **FR-007 explicit npm deprecation detection**, **FR-008 curated overlap heuristics**, neutral **FR-010 npm Registry health facts**, **FR-011 known-vulnerability detection**, **FR-012 framework/tool detection**, and **FR-013 static configuration detection**.

The API application now has a framework-independent quick-manifest service boundary, but no Fastify HTTP transport is implemented yet.

The npm Registry and OSV adapters are implemented. No GitHub repository acquisition adapter, worker, web application, source-usage rule, concrete production priority policy, or concrete scoring policy has been implemented yet.

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
- full advisory-detail lookups are separately bounded; reaching that bound preserves all batch
  matches/evidence and marks the source partial;
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

## 8. Completed milestone: Known-vulnerability finding rule

The first provider-backed finding rule is implemented in `packages/rules-javascript` by PR #15.

Accepted implementation:

- `JS-VULN-011@1` is a synchronous factual finding rule;
- the rule consumes source-bound `JavaScriptAnalysisMetadata.osv` metadata containing one exact
  report-level OSV `sourceId` plus a minimal snapshot and has no
  `rules-javascript -> data-sources` dependency;
- OSV/provider I/O remains entirely outside rule evaluation;
- the rule correlates OSV query results only when package name and queried version exactly equal a
  dependency-inventory fact's package name and preserved declared specifier;
- declared ranges/tags without an exact query result remain insufficient evidence;
- duplicate manifest declarations of the same package/version contribute to one finding basis;
- one stable finding candidate is emitted per package/version/advisory match;
- each finding identifies the dependency, advisory reference, stable rule identity, project
  declaration evidence, and OSV external evidence from the exact source bound to the normalized
  snapshot; the source carries retrieval-time provenance;
- source-provided severity is surfaced only as attributed metadata and is not converted into a
  StackLens severity label or score effect;
- batch matches remain factual findings even when optional advisory detail is unavailable;
- withdrawn advisories are not emitted as active known-vulnerability findings;
- incomplete OSV query coverage produces an insufficient-evidence limitation while retaining known
  matches;
- unavailable/mismatched OSV sources, missing snapshots, missing exact-version query results, and
  missing advisory evidence from the exact bound source produce conservative limitations rather
  than clean/secure conclusions;
- complete empty OSV results emit no vulnerability finding and no "secure" fact;
- finding priority, recommendations, and production scoring remain separate/unimplemented;
- focused rule-level and analyzer-core integration tests are synthetic and network-free.

Primary traceability:

`FR-011, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, SEC-002, GOV-002, GOV-006, GOV-007`.

## 9. Completed milestone: npm metadata dependency rules

The npm Registry-backed JavaScript/TypeScript rule slice is implemented in
`packages/rules-javascript` by PR #16.

Accepted implementation:

- `JavaScriptAnalysisMetadata.npmRegistry` carries source-bound normalized npm package snapshots;
- each snapshot is associated with one exact report-level npm Registry `DataSource.id`;
- npm-backed rules require external evidence tied to that exact source/reference;
- rules remain synchronous and add no `rules-javascript -> data-sources` dependency;
- shared deterministic dependency grouping/order/truncation helpers are reused by npm rules and
  FR-011 without changing existing vulnerability rule IDs or behavior;
- `JS-NPM-006@1` implements factual outdated detection for exact Semantic Version declarations;
- the declared exact version and npm `latest` comparison version must both exist as normalized
  registry version records;
- version precedence supports major/minor/patch plus prerelease ordering and ignores build metadata;
- findings explicitly distinguish major, minor, patch, and prerelease-to-release differences;
- ranges/tags/URLs/workspace and other non-exact declarations remain insufficient evidence until a
  resolved exact version source exists;
- `JS-NPM-007@1` emits factual findings only when the exact declared version carries an explicit
  normalized npm deprecation message;
- the optional FR-007 "unmaintained" heuristic is intentionally not implemented because no accepted
  deterministic maintenance threshold/basis exists yet;
- `JS-NPM-010@1` emits neutral package-level npm Registry health facts containing supported
  verifiable metadata such as latest dist-tag, latest publication time, and registry modification
  time;
- FR-010 facts do not label packages healthy/stale/unmaintained and do not create a combined health
  interpretation;
- partial sources may preserve observed positive facts/findings while retaining rule-specific
  partial-failure limitations;
- missing/ambiguous metadata, missing/unavailable bound sources, cross-source evidence, missing
  version records, and unsupported comparison versions produce limitations rather than invented
  conclusions;
- no production priority, recommendation, scoring, repository acquisition, or source-usage policy is
  introduced;
- focused rule-level and analyzer-core integration tests are synthetic and network-free.

Primary traceability:

`FR-006, FR-007, FR-010, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, SEC-002, GOV-002, GOV-006, GOV-007`.

## 10. Completed milestone: overlap plus framework/tool/configuration detection

The static JavaScript/TypeScript project-detection slice is implemented in
`packages/rules-javascript` by this implementation PR.

Accepted implementation:

- `JS-OVERLAP-008@1` emits medium-confidence heuristic findings only for explicit curated
  package/capability pairs;
- initial overlap rules cover Biome/ESLint, Biome/Prettier, Axios/Ky, Day.js/Moment, and
  Jest/Vitest;
- overlap findings name both packages/capability, preserve all dependency facts/evidence, explain
  why parallel ownership matters, and explicitly avoid claiming that either dependency is
  unnecessary;
- broad category similarity or fuzzy package-name inference does not create overlap findings;
- `JS-TOOL-012@1` emits deterministic manifest-backed facts for a curated exact-package catalog of
  supported frameworks, build tools, test frameworks, linters/formatters, TypeScript,
  state-management libraries, and observability tools;
- duplicate tool declarations produce one tool fact while retaining all declaration evidence;
- `JavaScriptProjectSnapshot` adds optional already-acquired static repository files to the
  normalized manifest without adding filesystem/GitHub acquisition behavior;
- static file paths are canonicalized/validated as relative POSIX paths and deterministic file order
  is preserved;
- `JS-CONFIG-013@1` identifies supported repository configuration files and inspects a bounded
  allowlist of high-level characteristics from strict JSON;
- TypeScript, legacy ESLint JSON, Prettier JSON, and Biome JSON are the first declarative
  configuration families;
- known JS/TS configuration families are identified by path but never imported, executed, or
  evaluated; partial inspection is recorded as a limitation;
- JSONC/comments, malformed/unsupported field shapes, and oversized configuration remain detected
  but limited rather than guessed;
- configuration evidence retains path/summary only and does not copy source content into the report;
- the static configuration inspection bound is 512 Ki characters;
- no GitHub acquisition, source-usage analysis, production priority, recommendations, or scoring is
  introduced;
- focused rule-level and analyzer-core integration tests are synthetic and require no live
  repository/network access.

Primary traceability:

`FR-008, FR-012, FR-013, FR-017, FR-021, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-002, GOV-006, GOV-007`.

## 11. Immediate next milestone: repository acquisition

Implement public GitHub repository acquisition for **FR-003** using the already accepted
worker/static-snapshot architecture and feed its output into `JavaScriptProjectSnapshot`.

Required properties:

- resolve and record an immutable Git commit SHA before analysis;
- fetch only bounded static repository content required by supported rules;
- do not execute repository code, package scripts, builds, tests, hooks, or configuration;
- enforce file-count, per-file, aggregate-content, and request/time bounds;
- skip/limit binary, generated, vendor, and unsupported content conservatively;
- treat symlinks/submodules as metadata rather than following/executing them unless a later accepted
  requirement changes that boundary;
- normalize repository-relative POSIX paths and reject unsafe traversal forms;
- preserve project evidence path provenance and repository identity;
- record skipped/unsupported/resource-limited content as analysis limitations;
- avoid retaining/logging full repository source by default;
- keep GitHub I/O outside analyzer rules;
- do not implement FR-009 source-usage conclusions, production scoring, private repositories, or
  write access in the same PR.

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

## 12. What not to do next

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

## 13. Pull-request strategy for the next session

Recommended next PR:

**Title**

```text
feat: add public GitHub repository acquisition
```

**Primary requirements**

```text
FR-003, FR-004, FR-013, FR-017, FR-021,
DATA-001, DATA-002, DATA-006,
NFR-001, NFR-003, NFR-004, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, SEC-008,
GOV-002, GOV-006, GOV-007
```

Keep the PR limited to immutable/bounded public GitHub snapshot acquisition, project evidence,
typed limitations/failures, integration with the existing static project snapshot/config rules, and
documentation.

Do not add private-repository authentication, repository writes, dependency installation, source
usage/FR-009 conclusions, production priority/recommendations/scoring, or product UI in the same PR.

## 14. Handover completion signal

The next session can consider repository acquisition complete when:

1. public GitHub repository input resolves to an immutable commit SHA before content analysis;
2. all network/filesystem work stays outside analyzer rules and no repository code/configuration is
   executed;
3. file-count/per-file/aggregate/time bounds are explicit and tested;
4. path traversal, binary/generated/vendor content, symlinks/submodules, and unsupported content are
   handled conservatively with limitations where material;
5. acquired supported static files feed the existing `JavaScriptProjectSnapshot`/configuration
   rule boundary without duplicating rule semantics;
6. repository identity/evidence provenance is deterministic and contract-valid;
7. secrets/full source are not retained or logged by default;
8. focused synthetic acquisition/integration tests are green;
9. the same PR completes journey/handover documentation before merge and the permanent CI gate is
   green.

Continue with the smallest bounded public-repository acquisition slice rather than combining
source-usage findings, scoring, private access, or UI behavior.
