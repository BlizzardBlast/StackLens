# StackLens Session Handover

> **Status:** Active implementation handover  
> **Prepared:** 2026-09-21  
> **Baseline branch:** `main`  
> **Baseline verification:** Resolve the current `main` HEAD and confirm its quality workflow is green before changing code.  
> **Architecture:** v0.1.10  
> **Completed milestone:** repository analysis orchestration — PR #21  
> **Immediate milestone:** Milestone J2 — persistent repository jobs and progress state  
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
   - `docs/adr/0011-deterministic-priority-recommendation-scoring-v1.md`;
   - `docs/implementation/analysis-contracts.md`;
   - `docs/implementation/analyzer-core.md`;
   - `docs/implementation/repository-analysis.md`;
   - `docs/implementation/repository-jobs.md`;
   - `docs/implementation/rules-javascript.md`;
   - `docs/implementation/scoring.md`;
   - `docs/implementation/quick-manifest-analysis.md`;
   - `docs/implementation/data-sources.md`;
   - `packages/contracts/README.md`;
   - `packages/analyzer-core/README.md`;
   - `packages/analysis-orchestration/README.md`;
   - `packages/persistence/README.md`;
   - `packages/repository-jobs/README.md`;
   - `packages/rules-javascript/README.md`;
   - `packages/scoring/README.md`;
   - `packages/data-sources/README.md`;
   - `apps/api/README.md`;
   - `apps/worker/README.md`;
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
- architecture v0.1.10;
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
- bounded immutable public GitHub repository acquisition in `@stacklens/data-sources`;
- permanent read-only GitHub Actions quality gate;
- pnpm workspace + Turborepo;
- TypeScript 7 strict type checking;
- Oxlint + Oxfmt;
- Vitest-based package tests.

The latest completed hosted-product slice is the **persistent public-repository job flow** from PR
#22. `@stacklens/analysis-orchestration` remains transport/persistence independent, while
`@stacklens/persistence`, `@stacklens/repository-jobs`, and `apps/worker` add the accepted
PostgreSQL/Graphile Worker delivery boundary without moving analyzer policy into runtime code.

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

The API application has a framework-independent quick-manifest service boundary, and
`@stacklens/analysis-orchestration` now provides the shared long-running public-repository workflow.
No Fastify HTTP transport is implemented yet.

The npm Registry, OSV, and public GitHub acquisition adapters are implemented, including explicit
bounded source-coverage state. Static source usage, migration/recommendation policy, production
priority, scoring v1, shared repository orchestration, PostgreSQL analysis/report persistence, and
Graphile Worker repository jobs are implemented. Fastify repository-job transport/status routes and
the product web flow are not yet implemented.

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
`packages/rules-javascript` by PR #17.

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
- recognized config-family filenames with unsupported formats/extensions, JSONC/comments,
  malformed/unsupported field shapes, and oversized configuration remain detected but limited
  rather than guessed;
- configuration evidence retains path/summary only and does not copy source content into the report;
- the static configuration inspection bound is 512 Ki characters;
- no GitHub acquisition, source-usage analysis, production priority, recommendations, or scoring is
  introduced;
- focused rule-level and analyzer-core integration tests are synthetic and require no live
  repository/network access.

Primary traceability:

`FR-008, FR-012, FR-013, FR-017, FR-021, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-002, GOV-006, GOV-007`.

## 11. Completed milestone: public GitHub repository acquisition

The bounded public GitHub REST acquisition adapter is implemented in
`packages/data-sources` by PR #18.

Accepted implementation:

- `GitHubRepositoryAdapter` accepts only supported HTTPS `github.com/<owner>/<repo>` repository
  URLs, with optional `.git` suffix/trailing slash normalization;
- credentials, query strings, fragments, non-GitHub hosts, non-HTTPS schemes, extra repository path
  segments, invalid refs, and private repositories fail safely;
- repository metadata is fetched from fixed `api.github.com` endpoints with redirects disabled;
- the requested/default ref is resolved to an immutable commit SHA before tree/file acquisition;
- recursive tree enumeration uses the commit tree SHA;
- selected files are fetched by immutable Git blob SHA rather than mutable branch-relative paths;
- the source/evidence reference is generated from the validated repository identity plus immutable
  commit SHA;
- the initial allowlist retrieves only root `package.json` and configuration filename families
  already consumed by FR-013;
- general JS/TS source files remain outside this slice and are deferred to FR-009;
- root `package.json` is prioritized before optional config files under tight budgets;
- defaults enforce 8-second per-request timeout, 8 MiB provider-response bound, 32 selected files,
  512 KiB decoded bytes/file, 2 MiB decoded bytes total, and 40 requests/acquisition;
- recursive-tree truncation remains usable partial evidence and is explicitly disclosed;
- generated/vendor recognized configs, unsafe paths, symlinks, submodules, non-UTF-8/binary files,
  Git LFS pointers, missing root manifests, over-limit files, and file-level provider failures are
  handled conservatively with limitations/partial failures;
- symlinks are never followed, submodules are never traversed, and Git LFS objects are never
  dereferenced;
- selected source/config contents stay only in the transient provider result required to build the
  project snapshot; they are not copied into `DataSource`, `ExternalEvidence`, limitations,
  partial failures, or logs;
- output carries contract-valid repository owner/name/ref/commit identity for reproducibility;
- selected `{path, content}` file output is structurally compatible with
  `JavaScriptStaticProjectFile`; orchestration can normalize/discard the raw manifest and pass
  config files directly into `createJavaScriptProjectSnapshot`;
- the adapter performs no project-code execution, package installation, build/test/script execution,
  or JavaScript rule evaluation;
- private repository auth/write access, worker/job orchestration, FR-009 source-usage conclusions,
  priority/recommendations/scoring, and UI remain outside this PR;
- normal PR tests are synthetic and use no live GitHub dependency.

Primary traceability:

`FR-003, FR-004, FR-013, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-001, NFR-003, NFR-004, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002, GOV-006, GOV-007`.

## 12. Completed milestone: static source usage analysis

PR #19 implements the first bounded **FR-009** repository source-usage slice.

Accepted implementation:

- public GitHub acquisition includes bounded JS/TS/JSX/TSX source files from immutable blob SHAs;
- acquisition exposes complete/partial source coverage without moving parsing into the provider;
- source parsing is behind a StackLens-owned adapter and currently uses `@babel/parser` under
  ADR-0010 because the accepted TypeScript 7 baseline is incompatible with the current
  typescript-estree release line;
- supported syntax includes ESM imports/re-exports, static-string CommonJS `require()`, and
  static-string dynamic `import()`;
- bare subpaths normalize to declared package identity while relative/builtin/protocol references do
  not count as external dependency usage;
- a bounded catalog accounts for deterministic configuration conventions, exact Prettier plugin
  references, and supported package-script executable conventions without executing anything;
- `JS-USAGE-009@1` emits positive static usage facts with project path/line evidence;
- parse failures, non-static dynamic references, and partial/unavailable acquisition suppress
  absence-based conclusions and produce insufficient-evidence limitations;
- `JS-UNNECESSARY-009@1` emits only heuristic potentially-unnecessary findings when supported
  coverage is complete;
- peer-only declarations are not flagged, and development/peer-involved declarations carry lower
  confidence;
- findings explicitly do not claim that dependency removal is safe;
- quick manifest analysis remains source-insufficient;
- no production recommendation, priority, scoring, worker, API transport, or UI behavior is added.

Primary traceability:

`FR-003, FR-009, FR-017, FR-021, DATA-003, DATA-004, DATA-005, DATA-006, NFR-001, NFR-002, NFR-003,
NFR-004, NFR-005, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007`.

## 13. Completed milestone: migration opportunities, recommendations, priority, scoring

PR #20 implements the first production policy slice for **FR-014–FR-021** and
**SCORE-001–SCORE-004**.

Accepted implementation:

- `JS-MIGRATION-014@1` identifies a migration-review opportunity only for an exact declared
  semantic version whose source-bound npm `latest` target crosses a major-version boundary;
- migration findings name current/target state, preserve project/npm evidence, remain
  medium-confidence heuristics, and explicitly do not make migration mandatory;
- `JS-PRIORITY-016@1` is the production JavaScript/TypeScript prioritizer;
- known vulnerabilities and explicit deprecations are high priority; major migrations, exact-version
  outdated findings, and curated overlaps are medium; potentially-unnecessary findings are low;
- heuristic confidence can cap/reduce urgency but can never increase it;
- `JS-RECOMMEND-015@1` converts supported finalized findings into evidence-backed actions after
  priority while preserving factual/heuristic basis and confidence;
- recommendations never execute changes and do not claim an automatic migration/removal is safe;
- `JS-COVERAGE-018@1` produces category scoring coverage facts/limitations;
- dependency coverage requires complete supported project/source usage plus complete usable npm
  latest metadata;
- security coverage requires exact dependency versions, a complete bound OSV source, complete
  exact-version query results, and explicit query-level provenance evidence;
- the OSV adapter now emits one source-bound query evidence record per exact package/version query,
  including zero-match results, without describing them as proof of security;
- `@stacklens/scoring` implements `stack-health-v1` behind analyzer-core's existing
  `AnalysisScorer` interface;
- scoring v1 deducts critical/high/medium/low findings by 40/25/12/5 points respectively from a
  category whose evidence coverage is complete;
- Dependencies and Security are the only numeric categories in v1;
- Maintainability, Testing, and Tooling are explicitly N/A/insufficient evidence until accepted
  complete-coverage policy exists;
- any material category limitation makes that category N/A rather than converting missing evidence
  into a score penalty;
- the v1 overall score is the arithmetic mean of Dependencies and Security only when both are
  available, with evidenceCoverage=40 to disclose that only two of five accepted category families
  are numeric;
- score contributions reference their triggering finding evidence and `SCORE-STACK-001@1`;
- priority mappings, score weights, category coverage, and overall formula are recorded in ADR-0011;
- no UI/API/worker code recalculates policy, and analyzer-core required no formula changes.

Primary traceability:

`FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021,
DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, DATA-006,
SCORE-001, SCORE-002, SCORE-003, SCORE-004,
NFR-001, NFR-002, NFR-003, NFR-004, NFR-005,
SEC-001, SEC-002, GOV-002, GOV-006, GOV-007`.

## 14. Completed milestone: repository analysis orchestration

PR #21 implements the first bounded Milestone J hosted-analysis vertical slice.

Accepted implementation:

- new `@stacklens/analysis-orchestration` package is reusable by API and Worker without either app
  depending on the other;
- `productionJavaScriptAnalyzer` binds the current production fact/finding rules,
  `JS-PRIORITY-016@1`, `JS-RECOMMEND-015@1`, and `stack-health-v1` without moving their policy
  into application code;
- `analyzePublicGitHubRepository` resolves the injected public GitHub provider snapshot, validates
  the root manifest, creates the static project/source-usage snapshot, collects bounded npm/OSV
  metadata, and invokes analyzer-core;
- GitHub acquisition/missing/invalid root manifest failures are terminal application errors;
- npm/OSV provider failures remain non-terminal report sources/partial failures so unrelated findings
  can still complete;
- OSV acquisition is attempted only for exact semantic-version declarations accepted by the shared
  JavaScript semantic-version parser;
- metadata acquisition is deterministically bounded to 100 unique package identities and 100 OSV
  exact-version queries; overflow becomes an explicit resource-limit limitation rather than negative
  evidence;
- transport-independent progress exposes repository/manifest/npm/OSV/analysis state and counts only;
- transient manifest/source/script contents are not copied into returned progress/report data;
- repository input records validated owner/name/ref/immutable commit and a commit-based fingerprint;
- full synthetic integration tests exercise the production analyzer composition and contract-valid
  report output without live external services;
- the architecture diagram now correctly shows provider I/O before analyzer-core rather than from the
  analyzer itself;
- Fastify, Graphile Worker, PostgreSQL persistence, and React UI remain outside this PR.

Primary traceability:

`FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-001, NFR-003, NFR-004, NFR-005, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002, GOV-006, GOV-007`.

## 15. Completed milestone: persistent repository jobs and progress state

PR #22 implements Milestone J2 around the shared repository workflow.

Accepted implementation:

- `@stacklens/persistence` owns the Drizzle/PostgreSQL `analysis` and `analysis_report` model;
- durable state stores public repository coordinates, progress/status, immutable commit/fingerprint,
  analyzer/rule/scoring/report versions, timestamps, failure summary, and final report JSON only;
- `@stacklens/repository-jobs` owns the `repository_analysis` task identity, minimal source-free
  payload, enqueue seam, and transient-progress → durable-stage mapping;
- unknown queue payload fields are rejected so source/manifest/script/provider bodies cannot enter
  durable queue storage;
- `apps/worker` composes Graphile Worker with the existing repository orchestration and real
  GitHub/npm/OSV provider adapters;
- active Graphile job ownership prevents a stale/duplicate job from mutating progress or terminal
  output for another in-flight execution;
- the same Graphile job can reclaim after interruption, supporting retries without cross-job races;
- retryable failures are returned to Graphile before the final attempt;
- the final attempt persists StackLens `failed` state and finishes the Graphile task, avoiding a
  permafailed queue row as the only failure record;
- successful reports with material limitations/partial failures persist as
  `completed_with_limitations`;
- PostgreSQL timestamps are normalized to ISO 8601 at the repository boundary;
- the permanent quality workflow provisions PostgreSQL 18 and runs integration coverage;
- Fastify and React remain outside this PR.

Primary traceability:

`FR-003, FR-004, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-003, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007`.

## 16. Immediate next milestone: repository-analysis HTTP transport

Milestone J3 should expose the durable job flow through the accepted Fastify REST/OpenAPI boundary:

- add authoritative Fastify request validation for public GitHub repository submissions;
- generate a non-guessable analysis ID at the API boundary;
- create/enqueue repository analyses through `@stacklens/repository-jobs`;
- return `202 Accepted` with the analysis identifier for new asynchronous work;
- add a read endpoint for durable status/progress and terminal report/failure state;
- reuse `@stacklens/persistence` repositories instead of querying Graphile internals;
- publish and test the OpenAPI contract;
- keep analyzer/provider sequencing in `@stacklens/analysis-orchestration`;
- keep React product screens for a subsequent bounded slice unless a tiny transport acceptance
  fixture is required.

## 17. What not to do next

Avoid these detours:

- do not import `apps/worker` from `apps/api`; API uses the shared job/persistence packages;
- do not duplicate repository orchestration in Fastify routes;
- do not expose Graphile Worker internal tables as the public status model;
- do not move analyzer, priority, recommendation, or score policy into API/worker/database code;
- do not persist repository source bodies, manifest text, scripts, or raw provider bodies;
- do not change `stack-health-v1` weights/categories without a scoring-version + ADR/test update;
- do not invent numeric Maintainability/Testing/Tooling scores without accepted coverage policy;
- do not introduce Redis/BullMQ; Graphile Worker/PostgreSQL is the accepted baseline;
- do not add private GitHub support, AI analysis, code-writing automation, or project execution;
- do not combine the full React product experience into the first Fastify transport PR.

## 18. Pull-request strategy for the next session

Recommended next PR:

**Title**

```text
feat: add repository analysis API transport
```

**Primary requirements**

```text
FR-003, FR-004, FR-017, FR-021,
DATA-006,
NFR-003, NFR-008, NFR-009,
SEC-001, SEC-002, SEC-003, SEC-007,
GOV-002, GOV-006, GOV-007
```

Start with the smallest end-to-end hosted transport path: validate a public GitHub URL, create a
stable asynchronous analysis record, enqueue it, return `202`, and let clients poll the durable
analysis status/report endpoint.

## 19. Handover completion signal

The next session can consider PR #22 complete when it verifies:

1. PR #22 is present on current `main` and permanent quality CI is green;
2. PostgreSQL stores analysis/report metadata but no repository source/manifest/script bodies;
3. the Graphile payload is restricted to analysis ID, public repository URL, and optional ref;
4. duplicate/stale jobs cannot overwrite another active execution;
5. retryable failures return to Graphile before the final attempt and final exhaustion is persisted;
6. provider partial failures can still produce `completed_with_limitations`;
7. final reports persist immutable repository identity and analyzer/rule/scoring/schema versions;
8. PostgreSQL-backed integration tests run in permanent CI;
9. architecture/README/AGENTS/implementation docs match the J2 package boundaries.

Then continue with Milestone J3 rather than adding UI directly around internal queue state.
