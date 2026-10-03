# StackLens Project Journey

This document is the chronological project log for StackLens. The path is historical; the journey now covers requirements, architecture, product design, tooling, implementation, corrections, and verification. It records not only what was chosen, but why.

## 2026-09-18 — Step 1: Requirements before interface

The project began by defining `docs/requirements.md` before implementation or visual design.

**Why:** StackLens should not become a dashboard whose behavior is invented by screens. Product behavior is defined independently and every later design or implementation choice must trace back to a requirement.

**Result:** stable requirement IDs such as `FR-017`, `SCORE-003`, and `SEC-001`.

## 2026-09-18 — Step 2: System architecture before frontend implementation

The architecture established a reusable deterministic analyzer, independent web/API/worker boundaries, and explicit evidence/scoring contracts.

**Why this matters to design:** the UI must render authoritative analyzer output rather than recreate product logic on the client. The report design therefore follows the structured concepts of facts, findings, recommendations, evidence, limitations, scores, and partial failures.

See [../architecture.md](../architecture.md).

## 2026-09-18 — Step 3: Frontend framework/tooling review

React + Vite + TanStack Router remains the MVP web architecture. Oxlint + Oxfmt replaced Biome. Next.js, T3, and TanStack Start were explicitly evaluated rather than ignored.

**Design implication:** StackLens does not depend on a framework-specific design model such as React Server Components. The design system must remain normal React/CSS architecture that could survive a future framework migration.

See [ADR-0005](../adr/0005-web-framework-and-tooling-review.md).

## 2026-09-18 — Step 4: Establish product-design principles

The interface direction is:

- developer-focused and information-dense without becoming visually noisy;
- evidence-first;
- calm and precise rather than futuristic/"AI scanner" themed;
- dark and light themes designed together;
- accessible without relying on color alone;
- honest about uncertainty and missing evidence.

See [principles.md](principles.md).

## 2026-09-18 — Step 5: Define MVP information architecture

The report is treated as the center of the product. The MVP journey is organized around:

`Input → Validation → Analysis progress → Report → Finding/Evidence detail`

The report hierarchy prioritizes:

1. state and limitations;
2. overall/category health;
3. urgent actions;
4. stack summary;
5. detailed findings by domain;
6. evidence and rule provenance.

See [information-architecture.md](information-architecture.md).

## 2026-09-18 — Step 6: Create low-fidelity wireframes

Wireframes were created before visual token decisions. They establish layout, hierarchy, navigation, and responsive behavior without committing to brand styling.

See [wireframes.md](wireframes.md).

## 2026-09-18 — Step 7: Establish the design-system strategy

Decision:

- StackLens owns its **tokens, visual language, product components, and patterns**.
- **shadcn/ui** is used as source-owned implementation scaffolding for generic UI primitives.
- New shadcn components use **Base UI** where appropriate.
- We do **not** hand-build complex accessible primitives such as dialogs, selects, popovers, menus, tooltips, comboboxes, or tabs unless a StackLens requirement cannot be satisfied by the underlying primitive.
- We **do** custom-design domain components such as `HealthScore`, `FindingCard`, `EvidencePanel`, `ConfidenceIndicator`, and `AnalysisLimitation`.

The token source adopts the DTCG JSON model so design values are not coupled directly to Tailwind classes.

See [design-system.md](design-system.md) and [ADR-0006](../adr/0006-design-system-and-prototyping.md).

## 2026-09-18 — Step 8: Define design tokens

The initial token set intentionally remains small:

- palette primitives;
- semantic light/dark colors;
- typography;
- spacing;
- radius;
- elevation;
- motion;
- StackLens-specific severity, evidence, confidence, and score semantics.

The canonical design-phase source is `design/tokens/stacklens.tokens.json`.

The CSS file beside it is a reference mapping for the prototype. During implementation, token generation should become automated rather than maintaining two independent token sources.

## 2026-09-18 — Step 9: Build disposable coded prototype

A standalone prototype was added at `design/prototype/index.html`.

It intentionally has no application framework or backend. Its purpose is to validate:

- hierarchy;
- visual density;
- light/dark semantics;
- input states;
- progress states;
- report navigation;
- scoring explanation;
- finding/evidence presentation;
- limitation visibility.

The prototype is disposable. Production code must be implemented later against the accepted architecture and contracts.

## Pending design-validation steps

Before product UI implementation:

- review the prototype visually on desktop and narrow viewport widths;
- verify text and semantic-color contrast;
- validate keyboard focus order and interaction expectations;
- decide final brand mark/logo separately from the system UI;
- create the first Figma design-system/prototype file once the target connected Figma workspace is unambiguous;
- translate accepted patterns into `packages/design-tokens` and `packages/ui`.

Any material design change should be appended to this journey rather than silently replacing the historical rationale.

## 2026-09-18 — Step 10: Validate the design baseline

Validation performed before merging the design baseline:

- parsed `stacklens.tokens.json` successfully as JSON;
- confirmed the file uses the published DTCG 2025.10 token structure and reference syntax;
- confirmed the prototype contains analyzer, progress, and report states;
- confirmed the prototype consumes the shared reference token CSS rather than defining an independent palette;
- aligned the token typography with the prototype's dependency-free system-font strategy;
- added explicit domain tokens for confidence and score states.

The visual values remain a v0.1 proposal. Their semantics are more important than the exact color values and may be tuned after visual/contrast review.

## 2026-09-18 — Step 11: Figma handoff boundary

A repository-native design baseline was completed without making Figma the only source of truth.

A Figma design-system/prototype artifact is still desirable for visual iteration. It was not created during this step because more than one Figma account is connected and the target workspace is not unambiguous. No design decision is blocked by that: the repo contains the durable specification, tokens, wireframes, and coded prototype.

When Figma is created, it should mirror these accepted artifacts rather than introduce undocumented product behavior.

## 2026-09-18 — Step 12: Repository-native Design v1 review

Figma was removed from the required workflow. The coded prototype and repository documentation are sufficient for StackLens and avoid making design progress depend on a rate-limited external editor.

The prototype was reviewed against interaction semantics, responsive navigation, report hierarchy, status/color contrast, evidence access, input validation, and limitation visibility.

The review found and corrected:

- insufficient light-theme status contrast;
- insufficient dark-theme heuristic contrast;
- incorrect primary-button foreground in dark mode;
- visual-only input tabs;
- missing package.json interaction;
- missing inline validation behavior;
- a non-modal evidence drawer;
- broken report anchors;
- non-functional compact navigation;
- limitations being too easy to miss;
- undersized key interaction targets.

See [review-v1.md](review-v1.md).

## 2026-09-18 — Step 13: Accept Design v1

After the review corrections and structural validation, Product Design v1 was accepted as the baseline for implementation.

This closes the pre-implementation design phase. The next journey phase is translating tokens and domain patterns into production `packages/design-tokens` and `packages/ui` rather than building screens directly.

## 2026-09-18 — Step 14: Bootstrap production design infrastructure

Design v1 moved from specification into reusable production packages without creating application screens.

The monorepo root now defines pnpm workspaces, Turborepo tasks, strict TypeScript configuration, Oxlint, Oxfmt, and a GitHub Actions quality gate.

Two packages were created:

- `@stacklens/design-tokens` — deterministic token generation from the canonical DTCG JSON;
- `@stacklens/ui` — source-owned generic primitives plus StackLens domain components.

This implements the architecture boundary documented after Design v1 instead of copying styles directly from the disposable prototype.

## 2026-09-18 — Step 15: Make design tokens generated, not duplicated

The DTCG JSON remains the only editable token source.

The design-token package now generates Tailwind/shadcn-compatible semantic CSS variables and resolved JavaScript values. A drift-check mode prevents generated token output from quietly diverging from the source.

Additional semantic tokens needed by real components—such as muted surfaces, input borders, danger, success, warning, and info—were added to the canonical source rather than invented inside components.

## 2026-09-18 — Step 16: Encode product semantics in UI APIs

The first domain components deliberately receive product meaning instead of deriving it.

Examples:

- `HealthScore` receives `state="good"` rather than deciding which score is "good";
- `FindingCard` receives classification, priority, confidence, category, and rule ID;
- insufficient evidence is represented by an explicit `score={null}` / `state="unknown"` path.

This keeps deterministic analyzer/scoring logic out of the UI and preserves **DATA-005** and **SCORE-001**.

## 2026-09-18 — Step 17: Correct tool versions at implementation start

The architecture-planning ADR named stable tool lines available at that earlier decision point. Before installing anything, current upstream stable releases were checked again.

The implementation baseline therefore moved to pnpm 12.4.2, TypeScript 7.0.x, Vitest 5.0.x, Base UI 1.8.x, and current Oxlint/Oxfmt/Turborepo lines while retaining the previously accepted architecture.

The correction is recorded explicitly in ADR-0007 instead of silently drifting from ADR-0002.

## 2026-09-18 — Step 18: Validate the design infrastructure on the real CI runner

The bootstrap was not merged after static review alone. GitHub Actions was used to exercise the actual dependency graph and strict quality gates.

The validation surfaced and resolved several implementation issues in sequence:

- pnpm caching could not initialize before the first lockfile existed;
- strict indexed-access checking found unsafe string indexing in badge labels;
- Vitest needed explicit DOM cleanup between tests;
- the accessibility linter correctly preferred native `<progress>` semantics;
- the corresponding test had to assert the native `value` contract;
- Oxfmt's Tailwind class sorting required generated theme CSS before formatting.

After correcting those issues, the bootstrap run passed install, token generation, TypeScript, tests, Oxlint, and Oxfmt and committed the normalized source plus the initial lockfile.

## 2026-09-18 — Step 19: Close bootstrap mode

The temporary write-enabled CI bootstrap was removed immediately after it served its one-time purpose.

Normal CI is now:

- read-only;
- lockfile-frozen;
- pnpm-cached;
- build-first for generated packages;
- strict typecheck;
- tests;
- Oxlint;
- Oxfmt check.

Generated design-token `dist/` output remains uncommitted and is recreated by the design-token package's `prepare`/`build` scripts. The DTCG JSON remains the only version-controlled token source.

## 2026-09-18 — Step 20: Harden the tooling and agent-development baseline

A second configuration review was performed after the initial CI-green bootstrap.

Current upstream guidance was rechecked for shadcn/ui, TypeScript, Turborepo, Oxlint/Oxfmt, and Codex.

The review found several improvements worth making before product implementation:

- shadcn's September 2026 `cn` migration had replaced the legacy `clsx + tailwind-merge` helper;
- current shadcn manual setup expects shared `shadcn/tailwind.css` utilities and `tw-animate-css`;
- the monorepo base TypeScript configuration mixed browser/bundler settings into what should be a runtime-neutral shared strictness layer;
- Turborepo did not hash the root DTCG token source even though the design-token package reads it;
- the test task declared `coverage/**` output even though no coverage artifact is generated;
- Oxlint's stable TypeScript 7 type-aware backend was available but not enabled;
- the repository had no shared editor configuration or Codex project instructions.

The production baseline was updated accordingly. The design intent and accepted product requirements did not change.

## 2026-09-19 — Step 21: Full PR and configuration hardening

Before merging the design-infrastructure bootstrap, the entire pull request was reviewed again for codebase-specific configuration, unnecessary abstraction, supply-chain hygiene, and future-agent continuity.

The review produced these corrections:

- removed `packages/ui/src/lib/utils.ts`; UI code now imports `cn` directly from the package;
- removed the public UI `./lib/*` export and unused TypeScript extension options;
- moved the shadcn CLI to development dependencies while retaining runtime UI dependencies where they are actually consumed;
- constrained Node to the selected 24.x LTS major;
- replaced the generic Node `.gitignore` with StackLens-specific generated/cache/environment entries;
- pinned the mature TypeScript-aware Oxlint bridge release and removed temporary pnpm release-age exceptions;
- made Oxlint warnings and unused suppression directives fail the quality gate;
- made design-token tests independently generate the artifacts they inspect;
- hardened GitHub Actions with immutable action SHAs and journey-continuity enforcement;
- formalized documentation continuity as **GOV-007**;
- added documentation governance and a requirements/documentation-aware pull-request template;
- made `AGENTS.md` and `CONTRIBUTING.md` explicitly require affected-document and journey updates before work is considered complete.

This step intentionally prefers small, direct configuration over abstractions or generic boilerplate that StackLens does not currently need.

Verification continues on the real GitHub Actions runner after the lockfile and canonical formatting are refreshed.

## 2026-09-19 — Step 22: Close the hardening bootstrap

The hardened dependency graph was resolved from a clean pnpm lockfile under the active minimum-release-age supply-chain policy.

The rebuilt lockfile contains `oxlint-tsgolint@7.0.2001` and no longer contains the recently published `7.0.2002` entries that caused the policy rejection.

The temporary write-enabled workflow completed successfully across:

- journey-continuity verification;
- clean dependency resolution;
- generated-token build;
- canonical formatting;
- pinned shadcn project validation;
- strict TypeScript;
- component/token tests;
- type-aware Oxlint;
- Oxfmt verification.

The temporary CI write permission is removed immediately after this step. The final steady-state workflow returns to read-only repository permissions and frozen-lockfile installation.

## 2026-09-19 — Step 23: Remove CI runtime-version duplication

The final configuration review found that GitHub Actions repeated the pnpm and Node versions already declared in `package.json`.

To reduce drift:

- `pnpm/action-setup` now reads the exact pnpm version from `packageManager`;
- `actions/setup-node` now reads the Node 24.x range from `engines.node`.

The GitHub Actions themselves remain pinned to immutable full commit SHAs.

The steady-state quality workflow is run again after this change so the single-source configuration is verified rather than assumed.


## 2026-09-19 — Step 24: Establish Analysis Report Contract v1

The next implementation layer after design infrastructure was the shared analysis-domain contract rather than product screens.

A new `@stacklens/contracts` package was introduced with Zod runtime schemas for:
- analysis input identity;
- data sources and evidence;
- normalized facts;
- factual and heuristic findings;
- separate recommendations;
- deterministic priority metadata;
- limitations and partial failures;
- overall/category score states and explainable contributions;
- the versioned aggregate `AnalysisReport`.

The model deliberately separates `evidence → facts → findings → recommendations`. This makes **DATA-005** structural: advice cannot accidentally be serialized as raw fact.

Key invariants include:
- heuristic findings require confidence and supporting facts;
- factual findings cannot carry heuristic confidence;
- external evidence cannot reference an unavailable source;
- fact-based recommendations cannot reference heuristic findings;
- insufficient evidence is a distinct score state rather than numeric zero;
- score contributions must reference evidence and at least one fact or finding;
- report-level references must resolve and collection IDs must be unique.

The existing React finding components were updated to consume classification, priority, confidence, category, and rule types from `@stacklens/contracts` instead of maintaining duplicate UI-owned unions. React remains presentation-focused.

ADR-0008 records the serialized v1 design. The implementation is documented in `docs/implementation/analysis-contracts.md`.

Verification for this step includes package build/type checking, runtime schema tests, UI compatibility checks, Oxlint, Oxfmt, shadcn project validation, and the normal journey-documentation gate.


## 2026-09-19 — Step 25: Validate and close the contracts bootstrap

The new workspace package required a lockfile refresh, so the quality workflow temporarily allowed a one-run branch write for dependency resolution and canonical Oxfmt normalization.

The bootstrap run completed successfully across:
- journey-continuity verification;
- dependency installation;
- contract/design-token builds;
- shadcn project validation;
- strict TypeScript across contracts and React UI consumers;
- contract and component tests;
- type-aware Oxlint;
- Oxfmt verification.

The resulting lockfile contains the new `packages/contracts` workspace importer and the mature pinned Zod `4.4.3` runtime dependency.

Temporary write permission was then removed. The workflow was restored to its normal read-only, frozen-lockfile configuration before merge.

A normal repository-authored commit is used to trigger the permanent workflow again; that steady-state run is the final merge gate for PR #6.


## 2026-09-19 — Step 26: Establish the deterministic analyzer core

After merging Analysis Report Contract v1, implementation moved to the reusable analyzer execution layer rather than directly adding ecosystem rules or screens.

A new `@stacklens/analyzer-core` package defines:
- immutable normalized analysis context boundaries;
- fact, finding, and recommendation rule interfaces;
- deterministic stage execution;
- stable rule-ID ordering;
- runtime rule-output ownership/requirement validation;
- per-rule failure isolation;
- scoring dependency inversion;
- contract-validated AnalysisReport assembly.

The pipeline is intentionally staged:

`normalized evidence/context → facts → findings → recommendations → scoring → report`

Rules in one stage cannot see sibling outputs. Finding rules see the completed fact stage; recommendation rules see completed facts/findings. This prevents hidden registration-order coupling.

Rule evaluation is synchronous so provider/network I/O cannot become an implicit rule behavior. External data must already be normalized before entering analyzer-core.

If a single rule throws or emits invalid output, its output is omitted and a deterministic rule-scoped partial failure + limitation is recorded. Duplicate rule IDs or missing requirement declarations are configuration errors detected before rule execution.

Analyzer-core defines `AnalysisScorer` but no score formulas. The future scoring package will implement that interface.

Focused tests cover ordering, stage visibility, exception isolation, invalid output, duplicate IDs, traceability, scorer integration, and caller-owned IDs/timestamps.

ADR-0009 and `docs/implementation/analyzer-core.md` document this boundary.

The next implementation milestone is a narrow JavaScript/TypeScript vertical slice for **FR-005 dependency inventory**, using normalized package-manifest evidence without external registry metadata.


## 2026-09-19 — Step 27: Validate and close the analyzer-core bootstrap

The new analyzer-core workspace package was exercised on the real GitHub Actions runner before merge.

The bootstrap validation surfaced two implementation-quality issues and corrected them without weakening repository rules:

- strict TypeScript found a negative-test fixture that had accidentally changed a serialized mutable array into a readonly tuple; the fixture was corrected to remain a valid `AnalysisFact` while testing only requirement-ownership behavior;
- type-aware Oxlint rejected redundant error constructors, unused imports, mutable `Array#sort()`, and an unsafe type assertion used only to bypass the contract in a test. The production/runtime validation remained, while the unsafe test escape was removed.

The successful bootstrap run then passed:
- journey continuity;
- dependency resolution;
- all workspace builds;
- canonical Oxfmt formatting;
- shadcn project validation;
- strict TypeScript;
- analyzer-core and existing test suites;
- type-aware Oxlint with warnings denied;
- Oxfmt verification.

The generated lockfile now contains the `packages/analyzer-core` workspace importer.

Temporary CI write permission is removed immediately after this step. The final merge gate is the normal read-only workflow with `pnpm install --frozen-lockfile`.


## 2026-09-19 — Step 28: Separate finding detection from priority policy

A full pre-merge SOLID/architecture review of PR #7 found one important mismatch: finding rules were emitting final `Finding` objects including priority, even though the accepted architecture defines priority as a separate deterministic stage.

The analyzer core was hardened before merge:

- finding rules now emit `FindingCandidate` without priority;
- a versioned `FindingPrioritizer` is part of the rule set;
- the prioritizer alone creates `FindingPriority`;
- priority output is validated for schema and rule ownership;
- a priority failure omits only the affected finding and records a partial failure/limitation;
- recommendation rules see only successfully finalized findings;
- project/metadata context is recursively `DeepReadonly` at the type boundary;
- analyzer/scorer versions are validated before rule execution;
- duplicate emitted IDs and invalid evidence/fact/limitation/finding references are isolated at the emitting rule;
- recommendation basis is checked against referenced finding classifications before report assembly;
- generated failure identifiers are deterministic and collision-safe within report collections;
- rule metadata moved to a shared `rule-definition.ts` abstraction so priority and detector rules do not depend on one another.

The architecture was bumped to v0.1.6 and ADR-0009/implementation/agent documentation were updated to match the executable pipeline.

This correction keeps detector logic, priority policy, scoring policy, and presentation as separate reasons to change, and restores the documented:

`facts → finding candidates → priority → finalized findings → recommendations → scoring → report`

flow.


## 2026-09-19 — Step 29: Validate the hardened analyzer-core boundary

The post-review analyzer-core design was validated on the real GitHub Actions runner.

The first read-only run proved that all semantic gates were already green:
- frozen dependency installation;
- workspace builds;
- shadcn project validation;
- strict TypeScript;
- analyzer-core, contracts, UI, and design-token tests;
- type-aware Oxlint with zero warnings/errors.

Only four analyzer-core files required Oxfmt's canonical source formatting. A temporary formatting-only workflow applied Oxfmt and reran the complete quality suite successfully without changing dependencies or the lockfile.

The temporary write permission is removed immediately after that formatting commit. The final merge gate returns to the normal read-only workflow with a frozen lockfile.

This validates the final SOLID boundary introduced in Step 28: finding detection, priority policy, recommendations, and scoring remain separate deterministic responsibilities.


## 2026-09-19 — Step 30: Create the implementation-session handover

After merging the deterministic analyzer core, the next implementation sequence was captured in a dedicated repository handover so a fresh session does not depend on chat history.

`docs/handover.md` records:

- the exact `main` baseline and architecture version;
- the source-of-truth reading order for a new session;
- non-negotiable analyzer/security/governance boundaries;
- the immediate **FR-005 dependency inventory** vertical slice;
- the current contract-representation question around dependency name/range/group;
- the intended `@stacklens/rules-javascript` package boundary;
- required fixtures, analyzer integration, and definition of done;
- the recommended sequence for later manifest, metadata, vulnerability, repository, source-analysis, scoring, and application milestones;
- explicit non-goals to avoid prematurely expanding scope;
- the expected next PR scope and requirement traceability.

The README now links directly to the handover.

This is documentation-only and does not change accepted product behavior or architecture. It exists to preserve **GOV-002**, **GOV-003**, **GOV-006**, and **GOV-007** across session boundaries.


## 2026-09-19 — Step 31: Implement the first JavaScript dependency inventory slice

The first ecosystem-specific analyzer slice implements **FR-005** without expanding into external
metadata, findings, priority policy, recommendations, or production scoring.

The Analysis Report v1 fact contract gained optional structured dependency-inventory details for the
dependency group and exact declared specifier. The generic subject still owns dependency identity,
and existing facts without details remain valid, so the additive extension keeps schema version
`1.0.0`.

A new `@stacklens/rules-javascript` package now:

- validates supported parsed `package.json` shapes without coercion (**FR-004**);
- normalizes dependencies, devDependencies, peerDependencies, and optionalDependencies in a stable
  order;
- keeps the same package in multiple groups as separate declarations;
- preserves exact version/range/tag/file/workspace/URL specifier strings;
- creates deterministic local project evidence without fabricated line numbers;
- emits one structured `dependency.inventory` fact per declaration through `JS-DEP-005@1`.

Focused fixtures cover all supported groups, empty groups, multi-group manifests, duplicate package
names across groups, scoped packages, complex specifiers, malformed groups, non-string values, and
insertion-order determinism.

An analyzer-core integration fixture uses an inert test prioritizer and explicit
insufficient-evidence scores, proving that FR-005 can produce a contract-valid report without
inventing findings or a perfect health score.

No provider/network I/O or analyzed-project execution was introduced.

**Traceability:** FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, NFR-005, SEC-001, SEC-002,
GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 32: Finalize the FR-005 handover baseline

PR #9 was squash-merged to `main` as
`7168467e458c63ed16cb7017fffe1ceae936da4f`, and the permanent post-merge quality workflow passed
on that exact commit.

The session handover now records that immutable merge commit as the completed FR-005 baseline
instead of the temporary pre-merge placeholder. No product behavior, architecture, or requirements
changed in this documentation-only continuity update.

**Traceability:** GOV-002, GOV-007.


## 2026-09-19 — Step 33: Establish the quick manifest application boundary

Implementation moved from rule-level FR-005 coverage to the first hosted-application orchestration
slice.

A new `apps/api` workspace application now exposes a framework-independent quick-manifest service
that:

- accepts both pasted and uploaded `package.json` content through one authoritative path;
- rejects empty input, invalid JSON, unsupported upload filenames, and malformed manifest shapes
  before analyzer execution (**FR-001**, **FR-002**, **FR-004**);
- reuses `@stacklens/rules-javascript` normalization and dependency evidence instead of duplicating
  ecosystem logic (**NFR-004**);
- creates a deterministic versioned content fingerprint and does not copy irrelevant manifest fields
  into the report (**SEC-003**);
- invokes analyzer-core in-process using caller-supplied analysis identity/time and an injected
  analyzer definition;
- remains anonymous and persistence-free (**FR-022**, **SEC-003**);
- records quick-input and missing-external-data limitations rather than treating unavailable evidence
  as negative evidence (**FR-021**, **PRD-004**).

The service deliberately does not introduce Fastify, multipart handling, authentication, database
persistence, npm/OSV/GitHub access, production priority policy, or production scoring formulas.
Those remain separate reasons to change under the accepted architecture.

Focused tests cover paste success, upload success, invalid JSON, unsupported files, invalid manifest
values, deterministic fingerprint parity across input modes, contract-valid report assembly, and
minimum-retention behavior for ignored manifest fields.

**Traceability:** FR-001, FR-002, FR-004, FR-005, FR-021, FR-022, NFR-001, NFR-004, SEC-001,
SEC-002, SEC-003, GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 34: Finalize the quick-manifest handover baseline

PR #11 was squash-merged to `main` as
`29643a66d36c295067e1907fb07620502a014ffa`, and the permanent post-merge quality workflow passed
on that exact commit.

The session handover now records that immutable merge commit as the completed quick-manifest
orchestration baseline instead of the temporary pre-merge placeholder. The active implementation
milestone remains the first npm package-metadata adapter.

No product behavior, requirements, architecture, or tooling changed in this documentation-only
continuity update.

**Traceability:** GOV-002, GOV-007.


## 2026-09-19 — Step 35: Establish the first external package-metadata provider boundary

PR #13 introduces the first `@stacklens/data-sources` package and implements the accepted npm
Registry adapter boundary without moving provider I/O into analyzer rules.

The adapter:

- fetches only from the fixed public npm Registry host;
- bounds npm package names to the documented 214-character maximum and verifies the generated
  registry reference also fits StackLens's source/evidence contract before network access;
- applies request timeout and response-size limits before provider data enters analysis;
- validates the returned package identity, version records, dist-tags, timestamps, deprecation
  values, and repository metadata as untrusted input;
- normalizes versions/dist-tags deterministically;
- preserves explicit per-version deprecation messages and publication timestamps needed by later
  **FR-006**, **FR-007**, and **FR-010** rules;
- emits contract-valid source/evidence provenance with retrieval time (**DATA-001**, **DATA-002**);
- converts HTTP, throttling/server, network, timeout, oversized-body, invalid JSON, and invalid
  provider-shape cases into typed source failures instead of treating missing data as a clean result
  (**NFR-003**, **PRD-004**);
- never exposes raw provider bodies or underlying network-error text in public failure messages;
- keeps publisher-controlled repository URLs as metadata only while evidence URLs are generated from
  the fixed npm Registry origin (**SEC-008**).

The package also formalizes the reusable `EvidenceProvider<TRequest, TData>` /
`ProviderResult<TData>` seam anticipated by ADR-0003 so OSV and later providers can reuse the same
success/failure vocabulary without coupling analyzer-core to network clients.

Tests use only synthetic responses. They cover scoped package URL encoding, provenance, deterministic
normalization, optional metadata, empty deprecation semantics, explicit deprecation, publication
times, repository metadata isolation, identity mismatch, malformed provider data, missing packages,
throttling, invalid JSON, request timeout, network failure, response limits, and pre-network request
validation.

The handover workflow is also corrected: implementation PRs must finish their own handover state
before merge and must not leave a squash-SHA placeholder that forces a second documentation PR.
Future handovers reference the milestone PR and require the next session to resolve and verify
current `main`.

**Traceability:** FR-006, FR-007, FR-010, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008,
GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 36: Establish the OSV vulnerability-data provider boundary

PR #14 adds the second `@stacklens/data-sources` provider and implements the accepted **FR-011** OSV acquisition
boundary without introducing vulnerability finding rules or provider I/O inside analyzer execution.

The implementation follows the current OSV API split:

- `POST /v1/querybatch` establishes exact package/version → advisory matches and preserves OSV's
  per-match modified timestamp;
- `GET /v1/vulns/{id}` resolves full advisory metadata for each unique matched ID.

The adapter deliberately accepts only exact npm semantic versions. Manifest ranges/tags/short
versions such as `^1.2.3`, `latest`, and `1.2` are rejected before network access so they cannot
be silently reinterpreted as installed versions.

Provider normalization preserves:

- deterministic package/version query identity;
- pagination completeness per query;
- advisory IDs and query match timestamps;
- advisory modified/published/withdrawn timestamps;
- aliases, related IDs, and upstream IDs;
- source-supplied top-level/per-package severity;
- affected package/version metadata;
- validated HTTP(S) advisory references;
- contract-valid OSV source/evidence provenance with retrieval time.

OSV evidence links are generated only from the known `https://osv.dev/vulnerability/` origin.
Provider-returned advisory reference URLs remain normalized metadata and must pass HTTP(S)
validation.

Partial failure semantics are conservative:

- failure of the initial query makes the OSV source unavailable;
- pagination/detail failures after valid match data was acquired preserve known matches and mark the
  source partial;
- repeated/exhausted pagination marks the affected query incomplete;
- full advisory-detail requests are separately bounded; hitting that bound marks the source partial
  while retaining every authoritative batch match/evidence link;
- a detail failure never erases the authoritative exact-version batch match;
- an empty complete match list is not translated into a "secure" conclusion.

The npm and OSV adapters now reuse a shared bounded-response reader and npm package-name validation
helper.

Synthetic tests cover deterministic query normalization, exact-version boundaries, batch provenance,
advisory/severity/reference parsing, withdrawal metadata, pagination, partial detail failures, unsafe
reference rejection, HTTP/invalid-JSON/transport/timeout provider failures, response/query/detail
safety limits, and explicit empty-match semantics. No live OSV request is needed for PR correctness.

The accepted requirements and architecture/ADR do not change; this step implements ADR-0003's
existing OSV decision.

**Traceability:** FR-011, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-002, GOV-006,
GOV-007.


## 2026-09-19 — Step 37: Establish the first provider-backed finding rule

PR #15 adds the first provider-backed finding rule. The JavaScript/TypeScript rule package now consumes pre-acquired normalized OSV metadata to implement
the first **FR-011** known-vulnerability finding slice without introducing provider I/O into analyzer
execution.

A new `JavaScriptAnalysisMetadata` interface defines only the OSV fields the rule needs. Its
`JavaScriptOsvMetadata` wrapper binds one exact report-level OSV `sourceId` to a minimal snapshot;
the inner snapshot is structurally compatible with the normalized OSV adapter data while preserving
the accepted package direction:

```text
rules-javascript -> analyzer-core + contracts
```

No `rules-javascript -> data-sources` dependency was added.

`JS-VULN-011@1` runs after dependency inventory facts and:

- correlates only package/version OSV query results that exactly equal a dependency fact's package
  name and preserved declared specifier;
- therefore leaves manifest ranges/tags without exact query evidence as insufficient evidence rather
  than silently treating them as installed versions;
- groups duplicate declarations of the same package/version into one finding basis;
- emits one deterministic factual security finding per package/version/advisory;
- references all matching project declaration evidence plus OSV external evidence from the exact
  report source bound to the snapshot;
- rejects cross-source advisory evidence even when another OSV source is otherwise usable;
- identifies stable rule/requirement provenance;
- surfaces only source-provided severity metadata, explicitly attributing it to the provider-supplied
  source or OSV;
- preserves an authoritative batch match when optional advisory detail is absent;
- excludes advisories marked withdrawn from active findings and records that state as a limitation;
- retains known matches while attaching an insufficient-evidence limitation when a query result is
  incomplete;
- produces conservative limitations for missing/unavailable OSV source, snapshot, exact-version
  query, or advisory evidence;
- emits no finding for a complete empty match set and never creates a "secure" fact.

Finding priority and health scoring remain outside this rule. The analyzer integration fixture uses
only a test prioritizer and explicit insufficient-evidence scores to prove report-contract
compatibility without introducing production policy.

The pre-implementation architecture review confirmed that the accepted report contract already
contains the required package subject, advisory evidence reference, source retrieval-time
association, limitation references, and stable rule identity, so no shared contract/schema version
change or ADR amendment is required.

A later exact-head review tightened provenance further: normalized OSV metadata is now explicitly
bound to its report-level `DataSource.id`, and advisory evidence must reference that exact source.
This prevents a caller with multiple valid OSV sources from accidentally satisfying one snapshot
with another source's evidence.

Focused tests cover active findings, duplicate declarations, severity attribution, detail-unavailable
matches, withdrawn advisories, incomplete query coverage, complete empty results, range declarations,
unavailable/missing OSV data, missing or cross-source external advisory evidence, source-binding
mismatches, unrelated query results, deterministic ordering, and analyzer-core integration.

**Traceability:** FR-011, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003,
NFR-004, SEC-002, GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 38: Add source-bound npm metadata dependency analysis

PR #16 adds the npm metadata dependency-analysis slice. The JavaScript/TypeScript rule package now consumes pre-acquired normalized npm Registry metadata for
**FR-006**, **FR-007**, and **FR-010** without adding provider I/O to analyzer execution.

`JavaScriptAnalysisMetadata.npmRegistry` carries minimal package snapshots bound to exact
report-level npm Registry source IDs. Rule support requires matching external evidence from the same
bound source/reference before provider-backed output can be emitted.

Three responsibilities remain separate:

- `JS-NPM-006@1` — factual outdated-dependency findings;
- `JS-NPM-007@1` — factual explicit npm deprecation findings;
- `JS-NPM-010@1` — neutral npm Registry health-signal facts.

The outdated rule intentionally starts from a conservative exact-version basis. It requires the
project declaration to be an exact supported Semantic Version, requires that exact version to exist
in the normalized registry records, and compares it with npm's normalized `latest` dist-tag only
when the comparison version record also exists. Supported comparisons distinguish major, minor,
patch, and prerelease-to-release differences.

Ranges, tags, URLs, workspace protocols, and other non-exact declarations are preserved but remain
insufficient evidence until a future resolved-version source exists. The rule does not infer an
installed version from a declaration range and does not claim that `latest` is automatically a safe
or recommended upgrade.

The deprecation rule selects only the exact normalized version record and treats a provider-supplied
deprecation message as factual evidence. The optional FR-007 "unmaintained" heuristic is deliberately
not implemented: no accepted deterministic inactivity threshold/basis currently exists, so adding
one would create unsupported product behavior.

The FR-010 rule emits a package-level fact containing only verifiable npm Registry signals such as
the `latest` version, publication timestamp when supplied, and registry modification timestamp when
supplied. It does not transform those values into "healthy", "stale", or "unmaintained" judgments and
does not create a combined health score.

Missing/ambiguous normalized metadata, missing/unavailable bound sources, cross-source evidence,
missing declared/comparison version records, unsupported comparison versions, and partial provider
state all have explicit conservative limitation behavior.

A shared internal rule-support module now owns deterministic dependency grouping/order/truncation
helpers used by the npm slice and the existing FR-011 vulnerability rule. This removes duplicated
mechanics while preserving existing FR-011 IDs and semantics.

Focused synthetic tests cover Semantic Version parsing/precedence, major/minor/patch/prerelease
classification, duplicate declarations, range/tag limitations, equal/older comparisons, missing
version records, source/evidence binding, partial providers, explicit deprecation, neutral health
facts, absence of an invented maintenance heuristic, and analyzer-core integration.

The accepted requirements and architecture do not change; this step implements the already-accepted
FR-006/FR-007/FR-010 behavior on top of the npm provider boundary from PR #13.

**Traceability:** FR-006, FR-007, FR-010, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, NFR-001,
NFR-002, NFR-003, NFR-004, SEC-002, GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 39: Add static overlap, tool, and configuration detection

PR #17 adds the next deterministic JavaScript/TypeScript analysis slice for
**FR-008**, **FR-012**, and **FR-013**.

`JS-OVERLAP-008@1` introduces an intentionally narrow curated overlap catalog. The first supported
pairs cover Biome/ESLint, Biome/Prettier, Axios/Ky, Day.js/Moment, and Jest/Vitest. A match is a
medium-confidence heuristic based on explicit package declarations and a known overlapping
capability. Findings explain why parallel ownership can matter while explicitly stating that
co-declaration does not establish that either dependency is unnecessary. Broad category similarity
does not produce a finding.

`JS-TOOL-012@1` identifies supported frameworks/development tools from exact dependency package
identities. It runs as a fact-stage rule directly over the normalized manifest, avoiding same-stage
dependency on `JS-DEP-005`. The initial catalog covers representative frameworks, build tools, test
frameworks, linters/formatters, TypeScript, state-management libraries, and observability SDKs.
Unknown packages are not guessed from names.

FR-013 requires repository analysis, while GitHub acquisition is intentionally deferred to the next
milestone. To keep that boundary clean, `JavaScriptProjectSnapshot` adds optional already-acquired
static files to the normalized manifest. Its constructor performs only in-memory validation,
cloning, path safety checks, duplicate rejection, and deterministic ordering; it performs no
filesystem or network access.

`JS-CONFIG-013@1` consumes that static snapshot. It identifies supported configuration files and
creates path-only project evidence. Strict JSON TypeScript, legacy ESLint, Prettier, and Biome
configuration can expose a bounded allowlist of high-level characteristics. Known JS/TS config
families such as Vite/Vitest/webpack/Rollup/Jest/ESLint flat/legacy config/Next.js/Prettier/Tailwind
are identified but never imported or executed. A later exact-head review tightened FR-013 so
recognized config-family filenames with unsupported extensions are also reported as
unsupported/partial rather than silently ignored. Dynamic values, JSONC/comments unsupported by
strict JSON, unexpected field shapes, and configuration above the 512 Ki-character inspection bound
remain partial/resource-limited instead of being guessed.

The configuration evidence deliberately excludes source content, and executable-looking fixture
content verifies that the rule has no evaluation path.

Focused synthetic tests cover supported/unknown tool detection, duplicate declaration evidence,
curated overlap behavior and deterministic ordering, no broad-category redundancy inference, static
path validation, declarative high-level config characteristics, dynamic code non-execution,
JSONC/malformed/resource-limit behavior, unrelated-file exclusion, and analyzer-core integration
using only test priority plus insufficient-evidence scoring.

No requirement or architecture amendment is needed: this implements the already accepted static
analysis behavior while preserving the existing modular-monolith/analyzer safety boundaries.

**Traceability:** FR-008, FR-012, FR-013, FR-017, FR-021, DATA-003, DATA-004, DATA-005, NFR-001,
NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 40: Add bounded immutable public GitHub acquisition

PR #18 adds the **FR-003** public GitHub repository acquisition boundary in
`@stacklens/data-sources`.

The adapter accepts only validated HTTPS `github.com/<owner>/<repository>` URLs. Conventional
`.git` suffixes/trailing slashes normalize, while credentials, query/fragment data, extra path
segments, non-GitHub hosts, non-HTTPS schemes, invalid refs, and private repositories fail before
analysis proceeds.

Acquisition follows ADR-0003's immutable sequence:

```text
validated repository
  → public repository metadata/default branch
  → requested/default ref
  → immutable commit SHA + tree SHA
  → recursive tree
  → selected immutable blob SHAs
```

All GitHub network requests use fixed `api.github.com` endpoints and redirects are disabled.
Selected files are read from Git blobs by SHA rather than from mutable branch-relative content URLs.
The resulting StackLens source/evidence reference is generated from the validated
`github.com/<owner>/<repo>/tree/<commit-sha>` identity.

The initial selection policy deliberately fetches only evidence required by rules already
implemented: root `package.json` plus supported configuration filename families. General JS/TS
source acquisition is deferred to FR-009 rather than downloading source before a source-analysis
rule exists.

Repository content is treated as untrusted. Tree modes are validated. Unsafe/noncanonical paths are
skipped. Recognized configs under generated/vendor directories are skipped. Symlinks are never
followed, submodules are never traversed, Git LFS objects are never dereferenced, and selected blobs
must be valid bounded UTF-8 text.

Default safety bounds are 8 seconds/request, 8 MiB provider response, 32 selected files, 512 KiB
decoded bytes/file, 2 MiB decoded bytes total, and 40 requests. Root `package.json` is explicitly
ordered before optional config candidates so resource pressure does not sacrifice the primary
project manifest first.

GitHub recursive-tree truncation and material file-level skips/failures preserve known useful content
as a partial source with explicit limitations/partial failures. Missing root `package.json` is
insufficient evidence for manifest-dependent JavaScript analysis, not a clean/negative result.

The adapter output records contract-valid owner/name/ref/immutable commit identity. Root manifest
content is separated from selected config files; downstream orchestration can normalize the
manifest, discard its raw content, and pass file `path/content` pairs directly into the existing
`JavaScriptProjectSnapshot` boundary without creating a package dependency from data sources to
JavaScript rules.

Selected source bodies are transient provider data only. They are not copied into provider evidence,
limitations, partial failures, or logging. The adapter itself contains no logging or project-code
execution path.

Current GitHub REST documentation reviewed for this implementation documents public unauthenticated
repository/tree/blob reads, recursive-tree truncation behavior, base64 Git blob responses, and REST
rate limits. The adapter uses API version `2026-03-10`.

Synthetic tests cover input validation, default/explicit ref resolution, immutable request ordering,
fixed-host/version/redirect behavior, contract provenance, deterministic selection, all resource
bounds, tree truncation, unsafe/generated/vendor paths, symlinks/submodules, binary/LFS handling,
missing manifests, partial file failures, malformed payloads, timeout/rate-limit/network/response
limits, and source-content isolation from public provenance.

No live GitHub dependency is part of PR correctness.

**Traceability:** FR-003, FR-004, FR-013, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-001,
NFR-003, NFR-004, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002, GOV-006, GOV-007.


## 2026-09-19 — Step 41: Add bounded static source usage analysis

PR #19 implements Milestone H for **FR-009**.

Public GitHub acquisition now includes bounded supported JS/TS/JSX/TSX files from the already-resolved
immutable commit. The adapter exposes explicit source coverage so later rules can distinguish a
complete supported scan from tree/file/byte/request/source failures. A final semantic review tightened
that boundary: skipped supported config/source evidence, generated/vendor supported analysis files,
submodules, and known code-bearing but unsupported `.vue`/`.svelte`/`.astro`/`.mdx` files now
keep absence-based coverage partial instead of silently becoming negative-use evidence. Existing
no-execution, symlink, binary/LFS, content-retention, and provider-provenance boundaries remain intact.

The JavaScript rules package adds a parser adapter rather than coupling finding rules to a concrete
AST. ADR-0010 records a necessary implementation adjustment: the original typescript-estree choice
is currently incompatible with StackLens's accepted TypeScript 7 baseline, so the first syntax-only
adapter uses the already-resolved `@babel/parser` release. Parser-specific AST shapes remain inside
the adapter.

Supported source references are ESM imports/re-exports, static-string CommonJS `require()`, and
static-string dynamic `import()`. Bare subpaths normalize to package identity. Relative, built-in,
URL/protocol, and package-import-map specifiers are excluded from external dependency usage.

The normalized source-usage snapshot also recognizes a narrow catalog of configuration filename
conventions, exact Prettier plugin strings, and supported package-script executable conventions.
No project script or configuration is executed.

`JS-USAGE-009@1` emits positive static-usage facts. Parse failures, unsupported dynamic references,
or incomplete/unavailable acquisition produce insufficient-evidence coverage rather than negative
usage claims.

`JS-UNNECESSARY-009@1` emits a potentially-unnecessary dependency finding only when supported
source coverage is complete and no supported source/config/script usage exists. Findings are
heuristic, peer-only declarations are excluded, development/peer-involved declarations receive lower
confidence, and descriptions explicitly state that removal safety is not established. The final
semantic review also makes the finding rule fail closed when FR-013 reports unsupported/dynamic
configuration evidence, preventing hidden plugin/config references from being interpreted as
dependency non-use.

Focused synthetic tests cover supported syntax forms, package/subpath normalization, dynamic/parse
uncertainty, configuration/script conventions, positive facts, complete-coverage heuristics, peer
exclusion, partial-coverage suppression, and GitHub source-coverage acquisition. No live GitHub
dependency or analyzed-project execution is used.

**Traceability:** FR-003, FR-009, FR-017, FR-021, DATA-003, DATA-004, DATA-005, DATA-006, NFR-001,
NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.

## 2026-09-20 — Step 42: Add deterministic migration, recommendation, priority, and scoring policy

PR #20 implements Milestone I across the existing staged analyzer boundaries.

The JavaScript/TypeScript rule package adds `JS-MIGRATION-014@1`, a deliberately narrow FR-014 rule
for exact-version dependencies whose source-bound npm `latest` target crosses a semantic major
boundary. The current/target versions and evidence are explicit, and the finding remains a
medium-confidence review opportunity rather than a mandatory upgrade.

Production priority is now concrete through `JS-PRIORITY-016@1` without moving urgency into detector
rules. Known vulnerabilities and explicit deprecations are high, major migrations/outdated/curated
overlap findings are medium, and potentially-unnecessary findings are low. Heuristic confidence can
only cap/reduce urgency.

`JS-RECOMMEND-015@1` runs after final priority and emits bounded evidence-backed actions for the
currently supported finding families. It preserves factual vs heuristic basis, suppresses the generic
outdated-version action when a more specific major-migration action exists for the same package, and
never executes or automatically applies repository changes.

Scoring required one additional evidence boundary: a clean security category cannot be justified by
the absence of vulnerability findings alone. The OSV adapter therefore emits source-bound query
provenance for every exact package/version query, including complete zero-match results, while still
avoiding any "secure" claim.

`JS-COVERAGE-018@1` now makes category scoreability explicit. Dependencies require complete project,
source/config/script, and npm latest metadata coverage. Security requires exact versions plus complete
OSV query coverage/provenance. Maintainability, Testing, and Tooling remain intentionally N/A under
policy v1.

The new `@stacklens/scoring` package implements `stack-health-v1` behind analyzer-core's existing
`AnalysisScorer` interface. Numeric categories start at 100 and use versioned priority deductions
(critical 40, high 25, medium 12, low 5). Any material category limitation yields N/A instead of a
penalty. The overall score is the mean of Dependencies and Security only when both are available and
reports 40% evidence coverage because only two of five accepted category families are numeric.

ADR-0011 records the policy, including the meaning and limits of a 100 Security score. Focused tests
cover priority ordering, migration detection, recommendation basis, score contributions, N/A
behavior, OSV query provenance, and the full analyzer → priority → recommendation → scoring report
flow.

**Traceability:** FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, DATA-001,
DATA-002, DATA-003, DATA-004, DATA-005, DATA-006, SCORE-001, SCORE-002, SCORE-003, SCORE-004,
NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-002, GOV-006, GOV-007.

## 2026-09-20 — Step 43: Compose the first hosted public-repository analysis workflow

PR #21 begins Milestone J with a transport-independent repository-analysis vertical slice.

The initial implementation briefly placed the long-running service under `apps/api`. Review caught
that this would force the future Graphile Worker to depend on the API application. The implementation
was corrected before merge by introducing `@stacklens/analysis-orchestration`, a shared application
package that both hosted runtimes can consume without cross-app coupling.

The package adds `productionJavaScriptAnalyzer`, which composes the already-accepted fact/finding
rules, production prioritizer, recommendation rule, and `stack-health-v1` scorer without moving
their policy into orchestration code.

`analyzePublicGitHubRepository` now connects the complete existing analysis chain: bounded immutable
GitHub acquisition → untrusted root-manifest normalization → static project/source-usage snapshot →
bounded npm metadata → exact-version-only OSV queries → sources/evidence/partial failures →
production analyzer → recommendations/scores/report.

GitHub acquisition or an unusable root manifest is terminal because no supported project snapshot
can be built. npm/OSV failures are deliberately non-terminal; their unavailable/partial sources and
typed failures are retained so unrelated facts can complete and affected scores become N/A rather
than falsely clean.

Provider enrichment is deterministically capped at 100 unique package identities and 100 exact OSV
queries. Overflow is represented as a resource-limit limitation. Progress events expose only
phase/count/failure state; repository source, manifest, and script contents stay transient and are
not returned in progress/report output.

The architecture context diagram was corrected as part of the same review: provider adapters perform
network I/O before analyzer-core; analyzer rules do not call npm/OSV/GitHub.

Focused synthetic integration tests verify a complete production flow, partial npm failure, skipped
OSV for non-exact declarations, terminal GitHub/missing/malformed-manifest behavior, progress
delivery, report schema validity, and source-content non-retention.

**Traceability:** FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001, NFR-003,
NFR-004, NFR-005, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008, GOV-002,
GOV-006, GOV-007.

## 2026-09-21 — Step 44: Persist repository analysis jobs and progress

PR #22 implements Milestone J2 by adding the accepted PostgreSQL/Graphile Worker delivery model
around the repository orchestration introduced in PR #21.

The implementation deliberately avoids API → Worker coupling. `@stacklens/persistence` owns the
Drizzle/PostgreSQL analysis and report state, while `@stacklens/repository-jobs` owns the minimal
source-free queue payload, stable task identity, enqueue seam, and mapping from transient orchestration
events to coarse durable progress. `apps/worker` composes those boundaries with the existing
`@stacklens/analysis-orchestration` workflow and production GitHub/npm/OSV adapters.

Review tightened idempotency beyond a simple status flag. Each running analysis records the active
Graphile job ID. Only that owner may persist progress or terminal output; a duplicate job cannot
overwrite an in-flight execution. The same Graphile job may reclaim its analysis after interruption,
which preserves retry behavior without allowing a different duplicate to race it.

Retryable failures return to Graphile before the final attempt. On the final attempt StackLens writes
a terminal failure and lets the queue job finish successfully, preventing a permanently-failed
Graphile row from becoming the only record of failure. Reports that complete with provider
limitations remain `completed_with_limitations`.

The Graphile payload is restricted to analysis ID, public repository URL, and optional ref. Unknown
payload fields are rejected so repository source, manifest text, scripts, and provider bodies cannot
silently enter durable queue storage.

A final queue review caught a Graphile-specific idempotency edge: the default job-key replacement
mode creates a competing job and exhausts a locked matching job. Repository analysis therefore uses
`unsafe_dedupe` for the stable analysis-ID job key. In this narrow case an ignored duplicate is the
intended behavior because it represents the same logical analysis, while database active-job
ownership remains the authority for execution writes.

The permanent quality workflow now provisions PostgreSQL 18. Integration coverage verifies durable
state transitions, execution ownership, retry state, report/version metadata, and stale-job
protection; focused worker tests cover at-least-once delivery and final-attempt behavior.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-001, DATA-002, DATA-006, NFR-003, NFR-008,
NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.


## 2026-09-21 — Step 45: Expose durable repository analysis through Fastify

PR #23 / Milestone J3 adds the first public REST/OpenAPI adapter over the persistent repository-analysis job
flow (**FR-003**, **FR-004**, **FR-017**, **FR-021**, **NFR-008**).

The API keeps transport concerns separate from analysis execution:

- Fastify 5 validates a strict repository request body and reuses the existing public-GitHub URL
  parser/canonicalizer instead of duplicating URL policy;
- the API generates a non-guessable UUID analysis ID, then calls the shared
  `@stacklens/repository-jobs` creation/enqueue seam;
- accepted work returns `202` plus the analysis ID;
- polling reads `@stacklens/persistence` and exposes StackLens status/progress plus terminal
  report/failure, never Graphile internal tables or active job identifiers;
- completed analyses without their transactionally expected report fail closed as unavailable;
- Zod route schemas are also the source for OpenAPI 3.1 at `/openapi.json`;
- dependency failures are mapped to source-free generic service errors and tests verify low-level
  queue messages do not leak;
- Fastify injection tests cover accepted/canonicalized submission, strict invalid input, queue
  failure, running progress, terminal report/failure, not-found state, and OpenAPI shape.

The implementation follows ADR-0002 and ADR-0004 and does not add a new architecture decision:
Fastify remains a replaceable adapter, Graphile/PostgreSQL remain the accepted async infrastructure,
and `@stacklens/analysis-orchestration` remains the only production repository workflow.

One operational edge remains intentionally visible: analysis-row creation and Graphile enqueue are
separate durable operations. If enqueueing throws, the HTTP request returns `503` without exposing
the generated analysis ID; the API does not delete or force-fail the row because queue commit outcome
can be ambiguous. Hosted-launch retention/reconciliation must handle such unreachable queued rows
without weakening the current source-free/idempotent job boundary.

Verification for this step is the focused Fastify test suite plus the repository-wide quality
workflow. The next bounded milestone is the React repository-analysis submit/poll/report flow.


## 2026-09-21 — Step 46: Add the first production repository-analysis web flow

Milestone K1 introduces `apps/web`, the first production React surface for StackLens.

The implementation keeps the browser deliberately thin. React 19 + Vite remain the accepted
ADR-0005 runtime, TanStack Router owns the stable analysis route, and TanStack Query owns
repository-analysis server state. A small injectable transport adapter submits the public repository
URL, forwards query cancellation to `fetch`, validates public status payloads with Zod, and validates
terminal reports with the shared `AnalysisReportSchema`.

The web flow now proves submit → durable polling → terminal state against the J3 API. Progress uses
only the coarse server stage names; it does not synthesize a percentage from stage position. Total
failure has a dedicated alert state, while `completed_with_limitations` renders the report with an
early limitations banner.

Report composition reuses the accepted shared UI vocabulary for finding cards, evidence coverage,
and limitations. Classification, priority, confidence, recommendation basis, evidence references,
and score values all come from the persisted report. React does not sort by a new local urgency
policy, derive score thresholds, or call GitHub/npm/OSV directly. Finding evidence can be disclosed
from the contract report and focus moves to that detail for keyboard users.

The repository URL form performs only obvious advisory syntax/HTTPS checks. GitHub-specific
acceptance remains authoritative in Fastify, and server validation errors preserve the user's input.

Focused synthetic tests cover transport request/response parsing, shared report validation, advisory
validation, input preservation, stage-only progress, terminal failure, limited completion, and
evidence disclosure. The web tests require no live provider, Worker, or database.

K1 also updates the architecture/agent guidance so future work preserves the web boundary. The next
bounded milestone is the quick-manifest Fastify/OpenAPI transport; the package.json web input remains
a separate follow-up.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006,
GOV-007.


## 2026-09-21 — Step 47: Make the accepted three-process architecture locally runnable

After K1 exposed the first real React repository-analysis flow, manual end-to-end use revealed an
infrastructure gap: the API and Worker existed as composable libraries but had no executable process
entrypoints, so the browser could not complete a real repository analysis from a fresh checkout.

The runtime slice adds PostgreSQL 18 through Docker Compose, explicit API and Worker process
entrypoints, graceful lifecycle ownership, real Drizzle/Graphile queue composition for Fastify, and
workspace-level `pnpm dev` commands. Development TypeScript execution uses `tsx`; production
`start` commands continue to run compiled JavaScript. StackLens schema bootstrap is serialized by a
transaction-scoped PostgreSQL advisory lock because API and Worker are intentionally started in
parallel.

The composition preserves existing boundaries: Fastify routes still depend on repository/queue
interfaces, the Worker still owns provider/orchestration execution, analyzed source never enters the
queue/database by default, and no analyzer/priority/recommendation/scoring policy moved into process
bootstrap code.

Verification includes a PostgreSQL-backed API runtime integration test plus the repository-wide
build, shadcn validation, typecheck, test, lint, and format gates.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-004, NFR-005, NFR-008,
NFR-009, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.  
**Decisions:** ADR-0002, ADR-0004.

## 2026-09-21 — Step 48: Refine the repository-analysis experience after real end-to-end use

Manual use of the locally runnable K1 flow exposed a UX gap that component-level correctness did not
make obvious: a real repository analysis can remain active for tens of seconds, while the production
screen gave too little visual feedback and the analyzer landing surface still felt like a bare
functional scaffold.

This refinement keeps the accepted analysis semantics unchanged and improves only presentation and
state communication:

- the repository landing screen now uses the accepted neutral-first developer-tool hierarchy rather
  than a single generic centered card;
- repository submission exposes an explicit busy state while the durable analysis is being created;
- the initial analysis-route fetch has a dedicated preparing state instead of a one-line placeholder;
- active analysis turns the existing coarse server stages into a clearer timeline with textual
  done/current/waiting states and a live explanation of the current stage;
- progress still never fabricates a percentage from stage position;
- small activity indicators respect reduced-motion preferences and do not replace textual status;
- focused tests protect the submission busy state, current-stage semantics, and no-fake-percentage
  rule.

The same pass corrected the local PostgreSQL port documentation and CI host/container mapping after
the Windows development setup moved the Docker host port to `55432`. PostgreSQL 18 continues to
listen on `5432` inside its container.

No analyzer, scoring, provider, persistence, queue, or API contract behavior changes in this step.
The next product milestone remains quick-manifest Fastify/OpenAPI transport.

**Traceability:** FR-003, FR-004, FR-017, FR-021, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002,
GOV-002, GOV-006, GOV-007.

## 2026-09-21 — Step 49: Make the development command self-preparing

Real local use after the runtime-composition and UX passes exposed one remaining developer-experience
paper cut: application package exports intentionally point at compiled `dist` output, so a fresh
checkout could fail if a developer ran `pnpm dev` before manually running `pnpm build`.

The root development workflow now keeps the compiled-package boundary without requiring that manual
step. `pnpm dev` first invokes `pnpm dev:prepare`, which uses Turborepo package-graph filters to
build only the shared dependencies consumed by `@stacklens/api`, `@stacklens/worker`, and
`@stacklens/web`; the three application packages themselves are excluded from this preparation.
The existing parallel web/API/worker watch processes start only after that preparation succeeds.

This deliberately avoids a full production application build on every development start. Turbo's
normal cache makes repeated preparation cheap when shared packages have not changed. Developers can
also run `pnpm dev:prepare` directly before launching an individual application package.

No production runtime, analyzer, provider, persistence, queue, API, or product behavior changes in
this step. The next product milestone remains quick-manifest Fastify/OpenAPI transport.

**Traceability:** NFR-005, GOV-002, GOV-006, GOV-007.

## 2026-09-22 — Step 50: Expose quick manifest analysis through Fastify

Milestone K2 completes the public transport boundary for the existing synchronous quick-manifest
service.

The API now exposes `POST /v1/analyze/manifest` through the same Fastify/Zod/OpenAPI stack as
repository analysis. The request is a strict tagged JSON union for pasted content or uploaded-file
semantics. Uploads carry the selected filename and text content, allowing the browser to own file
selection without introducing a second multipart analysis path.

The route remains deliberately thin. It creates only analysis identity/time, delegates validation,
normalization, fingerprinting, evidence construction, limitations, and analyzer execution to
`analyzeQuickManifest`, maps stable application validation errors to public `400` responses, and
returns the contract-valid report synchronously. Unknown fields are rejected and manifest content is
bounded to 524,288 characters.

Quick analysis remains anonymous and non-persistent: it creates no PostgreSQL analysis row, Graphile
job, repository polling state, or provider snapshot. A dedicated manifest-only analyzer runs the
dependency inventory rule and reports insufficient-evidence scores for categories that cannot be
supported by manifest-only data; it does not reuse repository-only source/provider rules or
`stack-health-v1` numeric scoring.

Focused Fastify injection tests cover paste and upload success, application validation errors, strict
schema/resource-bound failures, source-content non-retention, contract-valid report output, and
OpenAPI publication.

The next bounded product milestone is the React quick-analysis flow: paste/file input, accessible
synchronous busy/error states, and report rendering over this public K2 contract.

**Traceability:** FR-001, FR-002, FR-004, FR-005, FR-017, FR-021, FR-022, NFR-001, NFR-004,
SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007.


## 2026-09-22 — Step 51: Add the quick package.json web flow

Milestone K3 completes the second accepted anonymous analyzer input path in the production React
client.

The analyzer now exposes an explicit repository/package.json input-mode navigation matching Product
Design v1. The quick surface supports both pasted manifest text and local file selection. Browser
file input is intentionally local-read only: React reads the selected `File` as text and submits the
existing K2 `kind + filename + content` JSON shape. No multipart transport or parallel server-side
analysis path was added.

The new quick transport adapter is injectable and validates successful responses with the shared
`AnalysisReportSchema`. Stable API/application validation errors remain visible without clearing
recoverable user input. React performs only obvious empty-input checks; authoritative JSON, manifest,
filename, and resource validation remains in Fastify/application code.

Because quick analysis is synchronous, the interaction uses one explicit accessible busy state and
disables duplicate submission. It does not borrow repository polling, invent stages, show a fake
percentage, create persistence, or enqueue background work.

The page follows the accepted StackLens visual language rather than adding a generic form: neutral
surface hierarchy carries the layout, restrained primary accents identify interaction, the input
workspace is paired with a concise validate/inventory/evidence-limit explanation rail, and both wide
and narrow layouts retain the same semantic order.

Report presentation was moved out of the repository-specific feature into a shared analysis-report
feature. Both product paths now render the same contract/analyzer-owned evidence grammar without
duplicating scoring or finding semantics. Manifest reports add an early evidence-boundary explanation
so N/A states are explicitly interpreted as insufficient evidence rather than healthy results.

No Fastify change was required. The existing K2 route already provides strict Zod/OpenAPI schemas,
bounded input, stable public errors, and thin delegation to `analyzeQuickManifest`.

**Traceability:** FR-001, FR-002, FR-004, FR-017, FR-021, FR-022, SCORE-003, NFR-006, NFR-007,
SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007.


## 2026-09-22 — Step 52: Add automated MVP acceptance hardening

After K3 completed both anonymous product input paths, the next handover explicitly called for a
bounded acceptance/hardening pass rather than another analyzer feature.

Review found two integration assumptions that were not yet protected by acceptance-level tests.
First, K3's completion signal required `/quick` to be reachable through the production TanStack
Router, but existing tests exercised forms, transport adapters, and report components separately.
Second, the PostgreSQL-backed API runtime smoke proved the asynchronous repository path but did not
prove that the synchronous quick route was present in the fully composed runtime or remained
non-persistent there.

The web suite now renders the actual production router and traverses a continuous package.json ->
manifest report -> analyzer home -> repository submission -> stable analysis route -> terminal
repository report journey. It uses the real client singletons and mocks only their network methods,
so route registration, navigation, form wiring, TanStack Query handoff, and shared report rendering
are exercised together without live-provider dependency.

The API runtime integration suite now calls `POST /v1/analyze/manifest` through
`createStackLensApiRuntime` after the real PostgreSQL/Graphile/Drizzle composition is initialized.
It verifies a manifest report with explicit limitations and then confirms that the returned quick
analysis ID is not readable from durable repository-analysis state.

The hardening pass also corrected stale durable guidance that still described quick analysis as
future work after K3. No analyzer rule, score, provider behavior, transport contract, persistence
policy, or product interaction was changed.

The remaining acceptance work is intentionally manual/browser-oriented: fresh local startup, real
Worker/provider completion, keyboard/focus inspection, responsive visual review, and live proxy/API
error recovery.

**Traceability:** FR-001, FR-002, FR-003, FR-004, FR-017, FR-021, FR-022, NFR-006, NFR-007,
NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.

## 2026-09-22 — Step 53: Harden repository progress feedback from manual browser acceptance

Manual analysis of a real public repository exposed two small but visible progress-state issues that
the automated acceptance baseline could not judge: the numerals inside some circular stage markers
looked optically off-center, and the active row did not provide enough ongoing visual activity during
long provider/analyzer phases.

The repository progress timeline now keeps its existing real server stages and textual
done/current/waiting semantics while tightening only presentation:

- stage markers use an explicit fixed-size flex box with line-height-neutral numerals so digits remain
  visually centered inside their circles;
- only the active stage receives a subtle pulsing semantic-primary background layer, leaving the text
  itself stable and readable;
- the pulse is disabled under reduced-motion preferences;
- waiting and completed stages remain static, and no percentage or synthetic intermediate progress
  was introduced.

Focused web coverage protects the centered-marker class contract, active-only activity layer, and
reduced-motion fallback. Analyzer, provider, queue, persistence, API, and scoring behavior are
unchanged.

**Traceability:** FR-017, FR-021, NFR-006, NFR-007, NFR-008, GOV-002, GOV-006, GOV-007.

## 2026-09-22 — Step 54: Harden live GitHub acquisition against API rate limits

Manual browser acceptance against a real public repository exposed a provider-boundary failure that
synthetic tests had not surfaced: StackLens used anonymous GitHub REST requests only, so a developer
could exhaust GitHub's anonymous quota and receive a terminal `403`. The persisted message also
read "during repository repository" because the generic HTTP error template repeated the operation
name.

This step keeps the accepted MVP product boundary—public repositories only—but makes live
acquisition operationally reliable and the failure state actionable:

- `GitHubRepositoryAdapter` accepts an optional operator/developer token and forwards it only as a
  Bearer header to fixed GitHub REST GET requests;
- the worker reads that secret from `STACKLENS_GITHUB_TOKEN`; it is not queued, persisted, logged,
  returned to the browser, or used to unlock private repositories;
- configured tokens are validated as non-empty, trimmed, control-character-free strings before any
  request is sent;
- `429`, plus `403` responses carrying `x-ratelimit-remaining: 0` or `retry-after`, are
  classified as terminal `github_<operation>_rate_limited` failures so Graphile does not hammer a
  provider that explicitly asked clients to wait;
- retry guidance prefers `retry-after` and otherwise safely renders `x-ratelimit-reset` as UTC;
- generic forbidden responses remain non-retryable, provider response bodies stay out of failure
  messages, and operation wording now names repository metadata/commit/tree/blob work clearly;
- focused provider tests cover anonymous headers, authenticated headers, malformed-token rejection,
  primary/secondary rate-limit classification, generic `403`, and provider-detail redaction.

This is an FR-003/NFR-008 acceptance repair, not FR-100 GitHub account integration. User-connected
authentication, private repository access, and repository writes remain post-MVP.

**Traceability:** FR-003, FR-004, FR-021, NFR-003, NFR-008, NFR-009, SEC-002, SEC-003, SEC-007,
GOV-002, GOV-006, GOV-007.

## 2026-09-23 — Step 55: Make quick manifest analysis useful without inventing scores

Manual browser acceptance of a real package.json exposed a presentation and composition gap: the
quick analyzer correctly refused to calculate health scores without repository/provider evidence,
but the report showed N/A and 0% so prominently that a successfully parsed, information-rich
manifest looked indistinguishable from an analysis that had learned nothing.

This hardening keeps SCORE-003 and the evidence boundary intact while surfacing what StackLens can
actually prove from package.json:

- quick analyzer v2 runs `JS-DEP-005@1` dependency inventory plus manifest-safe
  `JS-TOOL-012@1` framework/tool detection;
- the curated `JS-OVERLAP-008@1` heuristic may run because its basis is the declared dependency
  inventory alone;
- emitted overlap findings reuse the production `JS-PRIORITY-016@1` and
  `JS-RECOMMEND-015@1` policies rather than introducing quick-only urgency/advice;
- exact-package tool signatures now include Expo, Expo Router, React, React Native, and Sentry for
  React Native, with unknown package names still never guessed;
- the shared report renderer adds a manifest-only **Verified from package.json** section with
  dependency-entry counts, supported tool/framework facts, and a collapsed declaration browser;
- the score area explicitly explains that quick-mode 0% is numeric-score evidence coverage, not how
  much of package.json StackLens parsed.

Numeric scoring remains `quick-manifest-insufficient-evidence-v1`. Source/configuration inspection,
npm/OSV provider conclusions, unused-dependency inference, and repository-only score coverage remain
unavailable in quick mode. Raw manifest text and ignored fields are still not persisted or copied
into the report, and no analyzed scripts/configuration are executed.

**Traceability:** PRD-003, PRD-004, FR-001, FR-002, FR-005, FR-008, FR-012, FR-015, FR-016,
FR-017, FR-021, FR-022, SCORE-003, NFR-001, NFR-004, NFR-006, NFR-007, SEC-001, SEC-003,
GOV-002, GOV-006, GOV-007.

## 2026-09-23 — Step 56: Restore visual separation in quick input selection

Manual browser review exposed a small layout issue in the quick-analysis input selector: the
`fieldset` used grid gap for its children, but browser handling of `legend` means that gap does not
reliably create visible separation between **Choose your input** and the two input-mode cards.

The legend now owns an explicit bottom margin, keeping the semantic `fieldset`/`legend` structure
while restoring the intended visual rhythm without changing spacing between the cards themselves.
A focused component test preserves the spacing class so the regression is visible in the normal
quality gate.

No analysis, validation, API, or scoring behavior changes.

**Traceability:** NFR-006, NFR-007, GOV-002, GOV-007.

## 2026-09-23 — Step 57: Use committed lockfiles as resolved-version evidence

Manual acceptance raised a valid evidence-model problem: real JavaScript projects commonly preserve
semver intent such as `^19.0.0` or `~57.0.23` in package.json while committing the exact resolved
version in a package-manager lockfile. StackLens previously treated every non-exact manifest
specifier as insufficient for version-specific npm/OSV rules, even in repository analysis where the
matching lockfile was already available.

This step adds FR-023 without weakening the evidence boundary:

- GitHub acquisition retains bounded root `package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock`
  inputs immediately after package.json in selection priority;
- `@stacklens/rules-javascript` owns package-manager-specific parsing and emits one normalized,
  package-manager-neutral resolved-dependency snapshot;
- package.json remains declaration intent and dependency-group evidence;
- an exact manifest version remains sufficient without a lockfile;
- a ranged declaration may use a lockfile version only when package name and exact declared specifier
  match deterministically;
- `packageManager` selects among multiple committed lockfiles; absent a recognized hint, StackLens
  refuses to guess;
- stale specifiers, malformed inputs, package-manager mismatches, missing direct resolutions,
  workspace/link targets, and unsupported non-semver resolutions become limitations;
- `JS-RESOLVED-023@1` emits bounded resolution facts/evidence while raw lockfile text remains
  transient;
- outdated/deprecation/vulnerability/migration/coverage rules advance to v2 and share one
  effective-current-version helper;
- repository OSV acquisition now queries the resolved exact version, so a declaration such as
  `react: "^19.0.0"` can safely query the lockfile-resolved `19.2.3`;
- Dependencies and Security score coverage can become numeric when lockfile resolution plus existing
  source/npm/OSV coverage is complete.

The numeric deduction formula does not change, so scoring remains `stack-health-v1`. Production
analyzer and rule-set identities advance to v2 because the accepted evidence semantics changed.
Quick package.json analysis remains synchronous/provider-free and does not accept lockfiles in this
milestone.

**Traceability:** FR-003, FR-005–FR-007, FR-010, FR-011, FR-014, FR-017–FR-023, DATA-001–DATA-006,
SCORE-001–SCORE-004, NFR-001–NFR-005, NFR-008, NFR-009, SEC-001–SEC-003, SEC-007, GOV-002,
GOV-006, GOV-007.

## 2026-09-23 — Step 58: Enforce design-system policy through Oxlint

Manual UI acceptance prompted a tooling review of
[`@shadcn/lint`](https://github.com/shadcn-ui/lint), an agent-oriented Tailwind design-system
linter that supports Oxlint directly.

StackLens already standardizes on Oxlint, Tailwind CSS v4, shadcn/ui, Base UI, semantic design
tokens, and shared UI primitives. Instead of adding a second lint process, the repository now loads
`@shadcn/lint@0.2.0` through Oxlint's JavaScript-plugin boundary.

Initial policy is intentionally narrow and strict:

- shared StackLens components are recognized through the `@stacklens/ui/components` import prefix;
- `shadcn/no-raw-colors` is an error, matching the existing design-system rule that product UI
  consumes semantic/domain tokens instead of raw Tailwind palette colors;
- existing Oxlint type-aware/correctness/import/accessibility rules remain unchanged;
- `pnpm lint` and the existing CI lint step automatically include the design-system policy;
- `pnpm ui:info` remains the structural shadcn configuration check and serves a different purpose.

Upstream recommends incremental rule adoption. StackLens also has `denyWarnings: true`, so adding a
rule as a warning would still fail CI. Additional rules such as `no-restyle`,
`no-arbitrary-values`, `no-inline-styles`, `require-static-classes`, and
`no-unknown-classes` should therefore be introduced only after measuring the current codebase and
defining intentional contracts/exceptions. This avoids either warning debt or broad suppressions.

The agent guidance was also corrected to reflect FR-023: exact current dependency versions may now
come from matching supported root-lockfile evidence rather than only exact package.json
declarations.

**Traceability:** NFR-006, NFR-007, GOV-002, GOV-006, GOV-007.

## 2026-09-23 — Step 59: Refine the production palette, typography, and visual rhythm

**Pull request:** [#37](https://github.com/BlizzardBlast/StackLens/pull/37)

A design review found that the cool neutral baseline suited StackLens's diagnostic purpose, but
repeated pale cards, long headlines, system-font fallbacks, and implementation-heavy instructions
made the input pages feel generic. The production design now pairs steel reading surfaces and
action blue with a deep teal evidence explanation. A small stack mark and shorter, left-aligned
headlines provide identity without borrowing severity colors for decoration.

IBM Plex Sans Variable and IBM Plex Mono are locally bundled free OFL-1.1 fonts; both license
notices ship with the web build. The shared font inheritance now reads canonical variables directly
instead of relying on a Tailwind utility variable being emitted. Text remains available through
system fallbacks and `font-display: swap`.

Both input modes share simpler form/navigation treatment. On compact screens the form precedes
supporting explanations. Native radio/current-page semantics now have visible checkmarks, including
a correction to a previously ineffective nested `peer-checked` dot. One main landmark and a skip
link replace nested main elements. Reports inherit the same typography and have a clearer section
hierarchy while keeping analyzer-owned meaning intact.

The theme follows the system preference and retains explicit overrides. Contrast review required
adjusting status shades, input borders, focus outlines, and destructive-button foregrounds for both
themes. Regression tests check actual tinted badge/limitation compositions and button hover states.
Motion is limited to control feedback, existing honest busy/stage feedback, and a 180 ms evidence
entrance. Reduced motion disables animations and transitions while preserving status text.

Verification:

- `pnpm check` passed: build, shadcn configuration, typecheck, tests, lint, and formatting.
- The web suite passed 21 tests; the token suite passed six tests, including light/dark contrast.
- Five existing database-gated tests were skipped locally without `TEST_DATABASE_URL`; CI provides
  PostgreSQL. Existing shadcn setup notices did not fail lint.
- Chromium checked both input routes at 320/390/768/1024/1440 px in both themes: no horizontal
  document overflow and one main landmark in all 20 combinations.
- Keyboard skip/focus/radio checks, synthetic file-upload/report/evidence flows, and compact
  repository progress/failure states passed. Reduced motion disabled evidence and progress motion.
- The browser loaded fonts from the local origin; production output includes both font licenses.

The [visual review](visual-refinement.md) contains the rationale and committed captures. Design,
implementation, ADR-0007, README, and handover documentation were updated; accepted requirements and
analyzer/scoring behavior are unchanged. The disposable original prototype remains historical.

**Traceability:** PRD-004, FR-001–FR-003, FR-017, FR-021, FR-022, NFR-006–NFR-008, GOV-002,
GOV-006, GOV-007.

## 2026-09-24 — Step 60: Verify contrast in rendered interaction states

**Pull request:** [#37](https://github.com/BlizzardBlast/StackLens/pull/37)

A follow-up contrast audit found that the passing palette was weakened by 80% opacity on waiting
and completed progress descriptions: light-mode text measured 4.04:1. The copy now uses opaque
muted foreground at 6.41:1. Outlined actions use the input-border token, and the evidence entrance
keeps its 4 px movement while preserving fully opaque text.

Chromium/axe review covered both themes, input and error states, selected/upload controls, busy
feedback, all priority/confidence report badges, limitations, expanded evidence, recovery actions,
and four progress-pulse positions. No text violations remained; control borders, focus, and the
glyphs flagged for manual review were checked separately. A 320 px upload view remained readable
and had no document overflow in either theme. The token suite now has ten tests, adding selected
and error surfaces, coverage bars, and layered activity-pulse contrast. `pnpm check` passed, including
21 web tests and ten token tests; five existing database-gated tests skipped locally without
`TEST_DATABASE_URL`. Evidence text stayed fully opaque at 0/90/180 ms, and reduced motion disabled
its animation.

The [contrast review](contrast-review.md) records methods, measured pairs, and scope. The design
system now explicitly requires opaque secondary copy and rendered-state checks in addition to
token calculations. Accepted behavior, font licensing, palette values, scoring, and architecture
remain unchanged.

**Traceability:** NFR-006, NFR-007, NFR-008, GOV-002, GOV-007.

## 2026-09-24 — Step 61: Own PostgreSQL pool and client error handling

**Pull request:** [#37](https://github.com/BlizzardBlast/StackLens/pull/37)

Startup logs exposed incomplete database error handling in both API and Worker. Each runtime
handled pool errors but omitted listeners on checked-out clients, leaving Graphile to install
fallback listeners after StackLens had already opened connections for migrations.

The shared persistence pool factory now attaches both handlers before the first connection and
routes errors through the existing runtime callback. Connection listeners are registered only for
new clients, and handlers remain present through shutdown. Entry-point logging continues to emit
error names rather than raw messages. Query errors, analyzer policy, queue retries, and accepted
product behavior remain unchanged.

Four focused tests cover pool/first-client error delivery, multiple clients and reuse, shutdown,
and the optional reporter. The local-development guide documents the ownership and lifecycle.

A PostgreSQL 18 smoke check used a temporary database and started both composed runtimes without
the missing-handler warning. Terminating only the smoke check's own idle API connection and
checked-out Worker connection delivered errors to the configured reporters; subsequent API reads
and Worker queries reconnected successfully. No external providers were called.

`pnpm check` passed with `TEST_DATABASE_URL` pointing to the temporary PostgreSQL database,
including all seven persistence tests and 22 API tests, with no database-test skips. The initial
parallel run exceeded the existing API runtime test's five-second timeout; it passed on rerun
without changing that timeout. The final build, typecheck, tests, lint, and formatting all passed.

**Traceability:** FR-003, NFR-009, SEC-007, GOV-002, GOV-007; ADR-0004.

## 2026-09-25 — Step 62: Recover evidence and explain five scoped scores

**Pull request:** [#37](https://github.com/BlizzardBlast/StackLens/pull/37)

The real KerjaLog report had 11 limitations: a 32-file ceiling, rejected historical npm
`deprecated: false` metadata for React, unresolved configuration, repeated provider notices, and
three scoring policies that were intentionally unimplemented. Accepted requirements and ADR-0012
now define five bounded scoring scopes before implementation changes.

The npm adapter accepts explicit false while rejecting other malformed values. GitHub collection
uses coordinated 512-file/520-request/8 MiB budgets, four concurrent blob requests, deterministic
retention, and explicit rate-limit/resource failures. A bounded parser inspects literal config
exports, immutable constants, and recognized wrappers without executing repository code; imported
presets and runtime values remain partial.

Repository analyzer/rule-set v3 uses `stack-health-v2`: version health, known advisories, major
migration readiness, static test setup, and tooling reproducibility. Each score requires its own
complete evidence, and overall requires all five. Missing evidence never becomes a penalty.
Unused-dependency heuristics keep their strict completeness gate and are outside the version-health
score. Quick composition v3 records recommendation rule v2 while retaining manifest-only N/A.

The report states scope and available-category counts instead of misleading evidence percentages.
Disclosures expose deductions or linked blocking causes. Duplicate notices are grouped ahead of
findings, distinguishing related areas from actually blocked scores. Legacy reports retain their
values and explicitly identify their unimplemented policies. Zero has its own score-floor
explanation. Existing palette, free fonts, and motion remain consistent.

`pnpm check` passed with 319 tests, including PostgreSQL integration tests in a temporary database
that was removed afterward. Browser review covered both themes at 320 and 1440 px, keyboard
disclosure/focus links, no horizontal overflow, and passing axe text-contrast checks. A fresh run of
the same immutable KerjaLog commit acquired all 351 source files and 47 npm packages in 51 seconds,
with no provider failures and one honest unresolved ESLint preset limitation. All five scores were
available; overall was 68. The original report was not rewritten.

Requirements, ADRs/architecture, package and implementation guides, report design, and handover
were updated. The [implementation record](../implementation/evidence-improvements.md) includes
scope, captures, and verification; new analyses require restarting the local composition. The next
session must check this PR's merge status and resolve/verify the current `main` HEAD.

**Traceability:** FR-003, FR-006–FR-010, FR-013–FR-021, FR-023, DATA-001–DATA-006,
SCORE-001–SCORE-004, SEC-001, SEC-002, NFR-001–NFR-008, GOV-002–GOV-007; ADR-0012.

## Step 63 — Workspace inspection and evidence-based scoring v3 (2026-09-27)

The previous policy let 25 KerjaLog updates and an overlap suggestion accumulate 312 dependency
points of deductions and counted major upgrades again under Maintainability. ADR-0013 replaces
that model with explicit deprecation/advisory risk bands and named static readiness checks.
Updates, optional migrations and heuristics remain visible without numerical penalties. Overall
cannot exceed an applicable dependency/security score. Unknown and not applicable stay distinct.

The v4 compositions inspect workspace manifests, catalogs/importers, exact resolutions, JSONC,
MDX, immutable local config graphs and static script delegation. Package ownership prevents sibling
usage from proving unrelated declarations are used. External preset internals, callbacks, custom
selectors and ambiguous target settings stay honestly unknown. Repository code is never executed.

Schema 2.0.0 carries inspection/provenance details and check-linked explanations; strict 1.0.0
readers preserve saved reports. React renders bands/checklists, package filters and grouped scoped
limitations using existing semantic colors and free IBM Plex fonts. Fastify/OpenAPI and storage
share the versioned schemas. Compatible readers precede writer activation; rollback retains both.

[PR #38](https://github.com/BlizzardBlast/StackLens/pull/38), on branch
`codex/workspace-inspection-scoring`, follows open PR #37 without another worktree.
Each phase has a scoped review and bounded remediation ledger in the
[implementation record](../implementation/workspace-inspection.md). Pinned recorded KerjaLog/Frey-ui
inputs with synthetic provider/test evidence verify four manifests/catalogs, supported JSONC/MDX
and actual Turbo member scripts, plus 25 unscored update notices. This is deterministic acceptance,
not a full live repository audit. Both report schemas round-trip through PostgreSQL and Fastify.

Browser checks cover keyboard disclosures, package filters, fact/evidence focus links, both themes
at 320/1440 px without horizontal overflow, and reduced motion. Captures are committed; no new
color meanings or fonts were introduced. Requirements, ADR/architecture, implementation/design
guides, AGENTS, README and same-PR handover were updated. Final quality results are in the phase record.

**Traceability:** FR-005–FR-009, FR-011–FR-023, DATA-001–006, SCORE-001–004, SEC-001/002,
NFR-006–008, GOV-002–007; ADR-0013.

## 2026-09-28 — Step 64: Make repository submission durably deliverable

The review-remediation pass closes `CR-P0-001`, `CR-P1-002` through `CR-P1-005`, and
`CR-P2-006` through `CR-P2-007` without changing the report schema, scoring formulas, priority
policy, or presentation-side calculations.

The JavaScript rules package replaces the Node-ESM-incompatible CVSS dependency with pinned
`ae-cvss-calculator@1.0.13`, isolated behind its existing base-score adapter. Fixtures cover CVSS
2.0, 3.0, 3.1, and 4.0 reference vectors, boundaries, malformed/duplicate metrics, and exclusion of
v4 Threat/Environmental adjustments. Drizzle moved to the stable 0.45 line, and `pnpm check` now
imports compiled rules under Node 24 before optionally starting/stopping both compiled runtimes when
`TEST_DATABASE_URL` is supplied.

Repository submission now atomically writes the public analysis record and an internal source-free
delivery record. API and Worker runtime pumps claim leased batches, retry ambiguous delivery through
the existing stable Graphile key, and retain delivered records until analysis removal. The public API
still returns `202 { analysisId }` and `queued` after durable creation; it never exposes attempts,
leases, queue IDs, or source. [ADR-0014](../adr/0014-transactional-outbox-delivery.md) records the
decision. npm Registry and OSV requests now reject redirects, while malformed JSON/content-type
Fastify failures are stable `400 invalid_request` responses.

Repository, paste, and local-file controls retain help text in `aria-describedby` when an error is
also announced. The UI package restores shadcn alias recognition with compatible `cn` and explicit
package-import path mappings; token tests use explicit `void` for Node test registration so the
restored lint policy remains clean.

Three capped self-review passes inspected dependency/runtime, transactional-delivery/HTTP/provider,
and UI/tooling/documentation changes. The final gate ran the full test graph with isolated
PostgreSQL persistence schema coverage, typecheck, lint, format, production audit, compiled runtime
smoke, and `git diff --check`. Browser-emulation evidence is limited to DOM accessibility tests;
no physical-device or assistive-technology device claim is made.

**Traceability:** FR-001–FR-004, FR-011, NFR-006, NFR-008, NFR-009, SEC-003, GOV-002, GOV-006,
GOV-007; ADR-0004, ADR-0014.

## 2026-09-29 — Eight review findings remediated

The approved correction plan addresses CR-P1-001–004 and CR-P2-001–004 from baseline `962146e`.
Verified npm workspace links now retain internal identity and avoid npm/OSV requests; unresolved
links stay limited. Node test discovery follows supported Node patterns, correcting the audited
Testing examples to 50 and 100 without changing the formula. Migration opportunities aggregate
matching current/target versions within each package scope and retain all contributing evidence.

API and Worker default to Compose port 55432 while preserving explicit overrides. Local upload
reads use generations so replacement cannot submit or overwrite stale content. Authoritative 404s
stop automatic polling/focus/reconnect requests while manual retry can resume active polling.
Inline evidence Close returns focus to its trigger or Findings heading. Quick completion announces
the result and focuses the report heading; reset returns to the introduction without load-time
or rerender autofocus. The local-read status sits outside its busy file panel.

JS-INSPECTION-018 advances from 1 to 2; JS-MIGRATION-014 from 2 to 3. Production and provider-free
quick analyzer/rule-set identities advance from v4 to v5. Schema 2.0.0, both report readers,
stack-health-v3 formulas, REST payloads, database schema and historical report values are preserved.
No migration, backfill, dependency upgrade or deployment change is needed.

The capped review used three sweeps across the complete ledger. Sweep 2 corrected peer-only npm
lookup and unsupported Node positional arguments; sweep 3 corrected the busy/live-status nesting.
Focused analyzer, orchestration, contracts, scoring, API/Worker and UI/web checks passed. Compiled
API/Worker smoke passed against an isolated PostgreSQL database with the smoke-only Worker task list.
Production-router tests cover both report schemas. Browser checks cover 1280px and 320px, both themes,
reduced motion, upload replacement, 404 recovery, visible keyboard focus and evidence controls with
no horizontal page overflow. This is browser/DOM evidence, not actual screen-reader testing.

The [remediation ledger](../implementation/review-findings-remediation.md) holds final full-gate,
cleanup, coverage and decision evidence. Changes were left uncommitted at the September 29 gate.

**Traceability:** FR-002, FR-003, FR-005, FR-014, FR-017–FR-023, SCORE-002/003,
NFR-006–NFR-009, SEC-001/002, GOV-002/007.

Final completion gate: `pnpm check` with `TEST_DATABASE_URL` passed all 491 tests, build, compiled
runtime smoke, UI configuration, typecheck, lint and formatting. The isolated database was removed
and PostgreSQL restored to its original stopped state. All eight findings are resolved for this scope.

## 2026-09-30 — Remediation submitted for review

The user authorized a new PR for the completed eight-finding remediation. The reviewed branch is
committed and proposed against `main`. No behavior or scoring policy changed after the September 29
completion gate; this entry records publication and preserves the earlier verification history.
See the [remediation ledger](../implementation/review-findings-remediation.md) for review coverage,
tests and exact changed paths. No merge or deployment is part of this step.

**Traceability:** GOV-002, GOV-007; FR-002, FR-003, FR-005, FR-014, FR-017–FR-023,
SCORE-002/003, NFR-006–NFR-009, SEC-001/002.

## 2026-09-30 — Final-review workspace correction

Final review of PR #40 found a remaining CR-P1-001 case: when a declared workspace member shares a
dependency name but neither a lockfile nor a package-manager hint is available, the dependency was
still sent to npm and OSV. The follow-up keeps this declaration unresolved without claiming a
verified internal edge. Unrelated dependency names remain external. This preserves conservative
provider eligibility and score limitations without changing reports, scoring formulas or schemas.

New unit and synthetic repository-analysis regressions cover missing lockfile evidence, zero
external-provider requests, inventory retention, absence of a fabricated internal edge and
insufficient-evidence scores. Both affected package suites and typechecks passed. The follow-up
remains in PR #40; no merge or deployment occurred.

**Traceability:** FR-005, FR-023, SCORE-003, SEC-001, SEC-002, GOV-002, GOV-007.

## 2026-09-30 — Live MVP release acceptance

PR #40 is now merged at `f51d2b6`; its baseline quality workflow passed. The user supplied KerjaLog
and frey-ui for live validation. Both immutable revisions completed through the real local React,
Fastify, PostgreSQL, transactional delivery, Graphile Worker and GitHub/npm/OSV flow. Paste/upload,
authoritative input errors, a real nonexistent-repository failure, quick non-persistence, terminal
polling and keyboard focus were checked. The
[release record](../implementation/mvp-release-readiness.md) preserves exact commits, analysis IDs,
durations, score states, provider limitations and representative screenshots.

Live acceptance exposed two additional gaps. Native quick-mode radios now derive names and help
from visible text instead of unsupported label-wrapper ARIA. `JS-NPM-010@2` filters external
installation declarations before grouping, removing misleading missing-npm messages for internal
links while preserving same-name external evidence. Production analyzer/rule-set identities advance
to v6; quick-manifest v5, schema 2.0.0, historical readers and stack-health-v3 stay as documented.

Both repositories were rerun after the corrections. The final frey-ui report retained three bounded
npm response failures and a GitHub file timeout, plus one distinct Vitest advisory across three
package scopes. Unknown scores stayed N/A. Sixteen final axe scans at verified 1280/320 CSS pixels,
both themes and reduced motion reported zero violations and no overflow. Decorative contrast
manual-review items were inspected separately. These observations do not claim actual screen-reader,
physical-device or deployed-host validation. The full gate exposed jsdom worker contention; limiting
the web suite to two isolated workers preserves its five-second timeout and makes the report/router
tests reliable in this pass. Final database-backed `pnpm check` passed all 501 tests, compiled runtime
smoke, typecheck, lint and formatting. Cache and cleanup details belong to the linked release record.
Changes remain uncommitted on
`codex/mvp-release-readiness`; no publication or deployment is part of this step.

**Traceability:** FR-001–FR-006, FR-010/011/017–023, DATA-001–005, SCORE-001–004,
NFR-005–009, SEC-001–003, SEC-007, GOV-002/007.

## 2026-10-01 — Vercel web and portable backend preparation

The user selected Vercel and requested a new backend target. ADR-0015 prepares the static web
deployment with a required HTTPS API origin, preserved REST prefixes, known SPA deep links and
browser/CDN no-store directives. Separate portable API/Worker images, PostgreSQL and Caddy TLS
routing keep the accepted asynchronous architecture intact. The existing local Compose boundary
remains PostgreSQL-only. Runtime images use pinned bases, production dependency trees, non-root
execution, read-only filesystems, health checks, resource/log caps and orderly shutdown.

Hosting review exposed an unenforced retention boundary. SEC-003 now makes finite hosted lifetime
and ownership-safe cleanup explicit. API runtime assigns a configurable 24-hour default; Worker
maintenance purges bounded expired terminal rows and cascades reports/delivery metadata while
preserving queued/running claims and legacy null-expiry records. Origin responses prevent caching.
A completed report removed between API reads follows the existing missing-analysis recovery.
Production entrypoints refuse missing database configuration. Analyzer identities, scoring,
report schemas and historical JSON remain unchanged.

Both user-supplied repositories completed through the Linux containers after durable queued state
survived an API restart with Worker stopped. KerjaLog retained a real OSV timeout and unknown
Security; frey-ui retained three oversized npm responses. Quick/error/non-persistence, startup
retention cascade and isolated PostgreSQL dump/restore were verified. The
[dated preparation record](../implementation/release-evidence/2026-10-01-hosting.json) identifies
initial and final image checks, provider limitations, quality-cache use and cleanup.
The new database regression initially exceeded five seconds during sequential fixture creation;
bulk inserts preserve its ownership/concurrency/cascade assertions and the normal timeout.
Node test promises and nonmutating sort requirements were corrected before the final gate.
Database-backed `pnpm check` passed all 511 tests, compiled runtime smoke, typecheck, lint and
formatting. Eighteen of twenty-two test-graph tasks were cached.

[Hosting](../implementation/vercel-hosting.md), [backend operations](../implementation/backend-hosting.md)
and [manual acceptance](../implementation/manual-release-validation.md) document activation and the
remaining real gates. No cloud account linkage, public certificate issuance, host provisioning,
Git publication or deployment is claimed. Changes remain uncommitted on the existing branch.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/006/007/008/009,
SEC-001/002/003/007, GOV-002/006/007; ADR-0002/0004/0014/0015.

## 2026-10-01 — Free-hosting feasibility

The user asked whether the backend can also use Vercel and whether a free provider is available.
Current primary documentation and Context7 confirm Fastify support on Vercel Functions, while
the current continuous Graphile Worker needs a separate host or an architecture migration.
The runbooks record Vercel Hobby's personal/non-commercial restriction and Oracle Always Free's
current 2-OCPU/12-GB free-tenancy allowance, capacity/reclamation constraints and payment-card
verification. Oracle remains a candidate; ARM64 runtime verification, account access and hostname
selection are unresolved. No provider selection, provisioning, deployment or runtime code change
was made. Documentation formatting and diff checks passed; the previous 511-test gate is historical
verification of the prepared implementation, not evidence of either public deployment route.

**Traceability:** PRD-006, NFR-004/009, SEC-003/007, GOV-002/006/007; ADR-0004/0015.

## 2026-10-01 — Managed PostgreSQL and no-card deployment review

The user selected Vercel, Northflank and Aiven, then retained the no-card constraint after actual
Northflank service creation required card verification. Its empty free project remains; no service
or payment method was created. This dashboard evidence corrects the earlier no-card blog guidance.
Aiven project `stacklens-preview` and PostgreSQL Free service `stacklens-preview-pg` were created
without a card, using the Free Asia Pacific allocation on DigitalOcean `blr`.

The shared persistence factory now validates CA PEM and pool limits, verifies server trust and
hostname, rejects URL SSL overrides and bounds connection acquisition. API/Worker entrypoints
forward those settings, and container checks reuse the same CA with one connection. The managed
configuration uses API max three and Worker max five/concurrency one. Local defaults and analyzer
policy remain unchanged. Focused tests cover SSL override rejection, malformed values, CA forwarding
and executable configuration. Live Aiven verification confirmed PostgreSQL 18.6, TLS, unrelated-CA
rejection, StackLens/Graphile migrations, quick reports, durable enqueue and provider-free Worker
startup/shutdown. The isolated verification database was removed.

Initial parallel quality execution hit existing test timeouts. The database-backed test graph then
passed serially; a subsequent lint diagnostic was fixed by validating the parsed certificate's CA
flag. The final database-backed `pnpm check` passed with 531 tests, with eighteen of twenty-two
test-graph tasks cached. Earlier container images are historical artifacts and must be rebuilt for
these runtime changes. No public API/Worker or Vercel release has been verified.

Railway remains a no-card candidate with limited trial/monthly credit. Its GitHub authorization
requests new account access and is staged for user approval; no Railway deployment or secret
transfer was performed. ClawCloud could not be resolved from the actual browser. The
[managed runbook](../implementation/managed-hosting.md) and
[dated evidence](../implementation/release-evidence/2026-10-01-managed-hosting.json) record resources,
limits and remaining activation/acceptance work. Architecture v0.1.17 and ADR-0015 describe the
managed database boundary; no requirement or report-schema change was needed.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0004/0015.

## 2026-10-01 — No-card compute preparation and resource check

The user completed Railway GitHub sign-in. A private `stacklens-preview` project now has two
offline services with non-secret runtime variables, Dockerfile builds and API startup health
configured. No source, database secrets, public domain, paid plan or deployment was uploaded.
The CLI is available but unauthenticated. Local source upload is supported without a Git push;
`.railwayignore` excludes environment files, diagnostic assets and generated outputs.

The Dockerfile preserves explicit API/Worker targets and adds a non-secret `STACKLENS_RUNTIME`
selector for hosts without a target-stage setting. Both selected Linux images rebuilt and passed
package identity, CA-backed Aiven health, non-root and read-only runtime checks. Temporary
containers, isolated databases and the local credential file were removed. Brief startup memory
observations (159.2 MiB API/167.8 MiB Worker) imply roughly $3/month RAM cost at Railway's advertised
rate, before CPU/network, exceeding its recurring $1 allowance. Its thirty-day/$5 trial therefore
remains an inactive preview option rather than a verified ongoing free host.

ClawCloud's main and regional endpoints did not resolve in the actual browser. Silly Development's
live signup form advertises no-card, non-expiring 0.25 CPU/256 MB RAM/512 MB disk Worker hosting,
but account access, Node 24 and outbound database connectivity remain open. A locally constrained
Worker completed frey-ui with limitations; KerjaLog failed and the anonymous GitHub allowance was
observed at zero afterward. Its failure payload and memory peak were not retained, so neither
failure causality nor complete resource fit is claimed. User signup is staged before provider
selection or credential transfer. The managed runbook/evidence distinguish these preparation
steps from public full-stack acceptance. The earlier 531-test gate covers unchanged application
code; fresh Linux builds verify the subsequent Docker selector change.

**Traceability:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0004/0015.

## 2026-10-01 — Free Worker server and Node 24 startup rehearsal

The user completed Silly Development signup and a Free `stacklens-worker-preview` Node server was
created without a card. Node 24 and `start-worker.js` are saved; the service remains stopped.
The panel's fixed startup runs npm for root package metadata and routes ordinary JavaScript through
ts-node. `scripts/prepare-silly-worker.mjs` now packages the reviewed Linux image with its production
dependencies, moves root package metadata, removes only packaged root TypeScript configs and adds
an ESM boundary plus `deploy/silly/start-worker.js`. This avoids workspace reinstallation and the
observed TS5083 monorepo-config lookup. The adapter loads private runtime configuration and delegates
to the existing Worker entrypoint; analyzer and durable queue policy are unchanged.

The approximately 16 MB compressed/88 MB unpacked archive passed local Node 24.17.0 panel-image
startup, verified Aiven TLS, StackLens/Graphile migrations and continued running at 256 MiB/no swap,
0.25 CPU and concurrency one. The memory peak reached the limit with reclaim pressure and no OOM
kill; complete repository-analysis capacity remains unverified. Temporary containers, isolated
databases and runtime files were removed. The final database-backed `pnpm check` passed 531 tests
with eighteen of twenty-two test-graph tasks cached, plus build/runtime smoke/types/lint/format.
Temporary upload API access, transfer of Aiven credentials to the new host and activation await
specific user authorization. No code or secrets were uploaded, and no release is claimed.

**Traceability:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0004/0015.

## 2026-10-01 — Free Worker activation and remote provider evidence

After explicit approval, a temporary Silly Development API key uploaded the reviewed 16,808,305-byte
Linux Worker archive and a separate private Aiven runtime file to `stacklens-worker-preview`
(`60761d98`). Initial startup exposed a panel decompression incompatibility: pnpm symlinks became
ordinary files, making the persistence package unavailable. The one-shot `deploy/silly/install.js`
checks the archive SHA-256 and uses native Linux `tar` to preserve those links. Failed extraction
files and diagnostic code were replaced, the installer/archive removed, and the normal Node 24
entrypoint restored with no extra packages or arguments. No analyzed repository was installed or
executed, and no paid resources or card were used.

Remote startup created StackLens/Graphile schemas, and Aiven observed certificate-verified TLS
sessions from the Worker host. A local compiled API submitted the public REST contract to the same
database; only the remote Worker executed provider jobs. frey-ui completed with schema 2.0.0 and
48 explicit limitations in 107.9 seconds. KerjaLog reached terminal `repository_unavailable` in
11.3 seconds because the host's anonymous GitHub quota was exhausted. The limited report also
retained npm response-size/timeouts. Sampled host memory peaked at 218.20 MiB; the Worker remained
running. This is bounded partial acceptance, not proof of fully acquired repository capacity.

A deliberate restart preserved terminal API payload hashes; the first immediate start request
exceeded its deadline, and a later start succeeded. Active-job recovery, remote retention/restore,
public HTTPS API/Vercel and real assistive-technology/device validation remain open. The upload key
was revoked, confirmed by `401` on reuse and an empty dashboard key list. Local upload credentials
were removed; the explicitly approved runtime file remains on the host. A public-only thirty-day
GitHub provider token was proposed and awaits separate approval. Changes remain uncommitted and
unpushed. The prior database-backed `pnpm check` passed 531 tests; the added installer passed fresh
lint/format checks and actual remote hash-checked extraction/link verification.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0004/0015.

## 2026-10-01 — Authenticated Worker acceptance and Render Free API preparation

After authorization and user-completed GitHub verification, a new thirty-day public-only token
was installed in the approved Worker's private runtime file, preserving existing settings and
mode `0600`. Authenticated core quota was 5,000 before use. Only the remote Silly Worker executed
the two provider jobs submitted through the local compiled API and shared Aiven database.
frey-ui at `6dbd184ace64d28c6a7ca7c2c75263215f4ac9bf` completed in 158.1 seconds with 24 limitations
and three bounded npm response-size failures. KerjaLog at
`9e5f869bbcf5b9d582f8e1453395ea2c06c79f83` completed in 127.0 seconds with five static-evidence
limitations and no provider failures. Both schema 2.0.0 reports preserved uncertainty. The Worker
stayed running; sampled memory reached 249.41 MiB of 256 MiB, so general capacity remains open.
The initial anonymous failures remain historical evidence. The second temporary upload key was
revoked, verified by `401` and an empty dashboard list; local private copies were removed.
The approved runtime GitHub token remains on the Worker and expires 2026-10-31.

The user completed Render GitHub sign-in. `deploy/render/render.yaml` prepares one Free Docker
API in Singapore, explicit manual deployment, shared Aiven secrets as unfilled placeholders and
`/openapi.json` startup health. It passes Render's published Draft 2020-12 schema. The actual
dashboard form selects Free/$0, Docker, Singapore, seven non-secret variables and automatic
deployment Off. It remains unsent, with `main` selected because the reviewed release branch has
no remote ref. Publication and Aiven credential transfer to this new provider need authorization.
No Render service, card, paid plan, public API or Vercel deployment was created. Free API idle
sleep and wake-up remain live acceptance checks; the independent Worker topology is preserved.

The documentation-impact pass updates current status, handover, architecture/ADR, managed/Vercel
runbooks and source-free evidence, with a dedicated Render activation guide. Product requirements,
analyzer policy and report contracts do not change. The existing database-backed quality baseline
is 531 passing tests; the new configuration is validated against the provider schema, with fresh
lint/format/diff checks recorded in the dated evidence. Public routing, active-job recovery,
remote retention/restore and real screen-reader/device checks remain open.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-001/002/003/007,
GOV-002/006/007; ADR-0004/0015.

## 2026-10-02 — Published release branch, Render blocker and Vercel API preparation

After explicit approval, commit `7ce34f0` was published in draft PR #41 and GitHub quality run
`36884582320` passed. The approved Render Free/$0 form selected that branch and received the two
Aiven values privately. Deployment requested Add Card verification describing a temporary $1
authorization. No card was entered; the fresh October 2 dashboard confirmed no services and the
restored form was blank. Configuration schema validity did not establish no-card eligibility.
The earlier Render preparation remains historical evidence. Worker remained running after eight
hours, with an observed idle 176.44 MiB of 256 MiB; this does not replace workload peak measurements.

ADR-0016 adds a separate optional Vercel Fastify API project rooted at `apps/api`. Its compiled
native entrypoint keeps the public contract and awaited delivery attempt, disables only the API
recovery timer, and attaches a one-connection default pool to Fluid Compute. The continuous Silly
Worker retains recovery, provider execution and retention. Portable process/container startup
remains supported. Aiven's 20-connection limit is global; per-instance pooling does not bound
autoscaling. Database values require new-destination approval and stay outside the static web project.

The real Fastify builder selected `app.mjs`, passed the configured frozen install/workspace build,
and traced Node 24 output with 1,765 files, 8,167,198 uncompressed bytes and embedded Graphile
migrations. A TypeScript trace problem prompted the small compiled JavaScript entrypoint; no
compiler or strictness setting was weakened. Native local HTTP checks passed OpenAPI, malformed
JSON, quick analysis, unknown-route JSON and uncached queued submission/polling. Database-backed
`pnpm check` passed 539 tests plus compiled runtime smoke, including the request-bound adapter.
The new tests initially failed two mock-type lint checks; both were corrected and the full gate passed.

The documentation-impact pass corrects stale unpublished/approval-pending Render status, updates
architecture, current handover and hosting guides, and adds dated source-free evidence. Requirements,
analyzer/scoring policy and report schemas do not change. No Vercel cloud runtime or backend secret
resource exists yet. Cloud TLS/cold/warm requests, public full-stack acceptance, remote recovery/
retention/restore and real screen-reader/device gates remain open; PR #41 remains draft.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/008/009, SEC-003/007,
GOV-002/006/007; ADR-0004/0014/0015/0016.

## 2026-10-02 — Vercel Hobby API project configured without activation

Adapter commit `2a507cb` was published in draft PR #41; GitHub quality run `36942657278` passed.
The authenticated Vercel dashboard created the separate Hobby project `stacklens-api-preview`
in `freys-projects`. An empty project was used after branch-URL imports were rejected; the existing
GitHub integration then connected StackLens successfully. Fastify, `apps/api` root, outside-root
workspace files, Node 24, Fluid Compute and Singapore are saved. Branch tracking selects
`codex/mvp-release-readiness`. The UI's suggested redeployment found no existing build; the overview
confirmed no Production or Preview deployments and zero Function invocations.

Builds were paused with `exit 0` before connecting Git. Production Config values pin Corepack,
one database connection per instance and 24-hour retention. Pull-request and commit comments are
disabled. No backend secrets, payment card, paid plan or live deployment were added. The new
Vercel database destination still requires approval; the prior transfer approval covered Render.

The documentation-impact pass updates README, current handover, hosting guides and dated evidence.
The earlier journey entry remains unchanged as a historical snapshot. No product behavior,
architecture policy, analyzer rules or report schemas change. The existing 539-test database-backed
gate and successful adapter CI remain the implementation evidence; this setup adds dashboard
verification, the repository formatting gate, JSON parsing and diff checks. Public API/web acceptance remains pending.

**Traceability:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007,
GOV-002/006/007; ADR-0015/0016.

## 2026-10-02 — Approved Vercel activation and cloud configuration correction

The user explicitly approved Aiven credential transfer to `stacklens-api-preview` and activation
on Hobby. Only the database URL and complete CA were copied from the approved Worker's private
runtime editor into API Production Secret values. The GitHub token remains Worker-only; no private
credential file or output was created locally. Temporary transfer bindings were cleared.
Builds now allow only the tracked release branch. The earlier paused attempt was confirmed canceled
by the Ignored Build Step; no card or paid plan was added.

The first actual cloud attempt `GSY6Sn1HFcDhvcHiYYV2NMDnphoE`, commit `ff4d91a`, failed in two
seconds before installation. Vercel CLI 62.1.0 rejected the `functions.app.mjs` override as an
unmatched API-directory pattern. The isolated native builder had not exercised this CLI validation.
The correction removes that override and preserves the 60-second limit through the supported project
default. The authenticated dashboard confirmed 60 seconds with Fluid Compute still enabled.

The documentation-impact pass updates current status, handover, hosting runbooks and dated evidence;
the failed attempt stays recorded. No runtime, contract, analyzer or product-policy behavior changes.
Configuration JSON parsing, formatting/diff checks and new branch CI verify the correction;
cloud boot and public API/web acceptance remain pending.

**Traceability:** PRD-006, FR-003/004/022, NFR-004/008/009, SEC-003/007,
GOV-002/006/007; ADR-0015/0016.

## 2026-10-02 — Native Fastify startup capture correction

Configuration commit `f661bec` passed GitHub quality run `36945252902` and built in 29 seconds
as Vercel deployment `EMDGL6Zto5tD6Mcak5ekZSeNUygF`. The dashboard confirmed one Singapore
Node 24 Function, 2.61 MB and a 60-second duration. Ready did not prove availability: the public
OpenAPI request returned 500 with `INTERNAL_FUNCTION_INVOCATION_FAILED` and no application logs.

Inspection of the current native runtime showed that it intercepts HTTP listen, imports user code,
then binds the captured server. A local replay captured the previous entrypoint's server but its
import remained pending until the test bound it. Awaiting Fastify listen at module scope therefore
deadlocked startup. The entrypoint now starts listening without blocking import completion, retains
sanitized failure handling and exports its runtime for graceful isolated teardown. A new compiled
smoke captures the real entrypoint before binding and checks actual OpenAPI and malformed JSON HTTP
responses. It uses disposable PostgreSQL and never registers provider tasks.

The documentation-impact pass updates current status, handover, the API/web/managed runbooks,
ADR-0016 lifecycle detail and source-free evidence. Product requirements, analyzer policy, serialized
contracts and queue behavior remain unchanged. The corrected capture replay and database-backed
539-test gate are required before redeployment; cloud/public full-stack acceptance remains pending.

**Traceability:** PRD-006, FR-003/004/022, NFR-008/009, SEC-003/007, GOV-002/006/007; ADR-0016.

## 2026-10-02 — Explicit native HTTP handler export

Deployment `CNCvRBZvSWjL8m8oPkHmcAvxJZQC` built capture correction `9ec89bc` in 27 seconds.
The prior import deadlock was removed. Startup progressed through database initialization, then
Vercel rejected the named-only module: the default export must be a function or server. Public
OpenAPI still returned 500. The entrypoint now exports the captured HTTP server as its default
handler. The compiled capture smoke additionally verifies that default export's type and identity.
Pool attachment emitted three release-outside-request warnings during startup; these are recorded
as lifecycle diagnostics, not route acceptance. The separate empty Hobby web project was created
as `stacklens-web-preview`; it has no backend secrets or deployment.

The documentation-impact pass adds this failed attempt without rewriting earlier evidence and
updates the API runbook and ADR-0016 module contract. No product policy or report schema changes.
Database-backed quality and public cloud revalidation are required before using the API origin.

**Traceability:** FR-003/004/022, NFR-008/009, SEC-003/007, GOV-002/006/007; ADR-0016.

## 2026-10-02 — Host-owned native HTTP binding

Deployment `4R1WiVXW1UUU3BKN6Gm2PjrDJVeK` built `2eb9da3` in 24 seconds. The server export
was accepted, but the remaining asynchronous Fastify listen call failed and stopped the runtime;
public OpenAPI returned 500. The invocation reported the sanitized listen failure, 2.88-second
execution and 357 MB Fluid memory. The entrypoint now awaits Fastify readiness and exports its
unbound HTTP server without calling listen. HTTP binding belongs entirely to the host.

The smoke now forbids application binding during import, verifies the native server export, binds
it as the host and checks OpenAPI/malformed JSON with graceful teardown. This closes a gap in the
earlier capture-only replay, which waited for Fastify's listen call before binding and missed the
cloud race. API process startup remains unchanged. The separate Hobby web project is connected
to StackLens with Vite, Node 24 and the repository root; builds stay paused pending API verification.

The documentation-impact pass updates the API runbook, ADR-0016 and source-free failure evidence.
Product requirements, queue payloads, scoring and report schemas remain unchanged. The database-backed
quality gate and a new public cloud check are required before assigning the web proxy origin.

**Traceability:** FR-003/004/022, NFR-008/009, SEC-003/007, GOV-002/006/007; ADR-0016.

## 2026-10-02 — Public Vercel preview acceptance and Worker restart gap

Runtime `75bf5a2` passed CI and built the API in 27 seconds. Exporting a ready, unbound HTTP
server lets Vercel bind Fastify; public OpenAPI/JSON errors/quick reports now pass. The separate
Hobby web project builds the root programmatic configuration in 14 seconds and proxies the verified
API origin. Both targets use only the reviewed branch's Production environment. The platform label
is a personal preview, not a release. No card or paid plan was added; Aiven secrets remain API/Worker
only and the provider token remains Worker-only. Earlier failed cloud attempts stay recorded.

Both requested repositories finish with contract-valid reports through the direct API and actual
web forms. Provider/static limitations remain visible. Browser acceptance covers invalid input,
quick busy/result/reset focus, native file replacement, stable deep links, terminal failure, evidence
Close focus return and 320px emulation. CDP observes no extra terminal status requests over 62 seconds.
Static asset types and missing-asset/API errors pass; quick identifiers remain transient.

Restarting the remote Worker during KerjaLog exposed a recovery gap: the old process exited and a
new Worker connected, but the analysis remained running. Durable completion occurred at 05:04:53 UTC,
4h 10m after submission, consistent with Graphile's stale-lock recovery. No manual unlock ran and
no temporary recovery helper was saved. A panel sample reached 257.36 MiB against its displayed
256 MiB cap. These observations do not prove prompt recovery, capacity or absence of OOM.

The documentation-impact pass updates README, handover, API/web/managed runbooks, architecture,
ADR-0016 activation status, manual acceptance guidance and source-free dated evidence. Product
requirements, analyzer/scoring policy, tokens and serialized contracts are unchanged. The same
539-test database-backed runtime gate and successful CI cover the deployed implementation; this
documentation pass adds formatting, JSON parsing, link/diff checks and publication CI. PR #41 remains
draft and unmerged. Prompt Worker recovery/capacity, Function suspension, remote expiry/restore and
real screen-reader/device acceptance remain release gates.

**Traceability:** PRD-006, FR-001/003/004/022, NFR-004/006/007/008/009,
SEC-001/002/003/007, GOV-002/006/007; ADR-0015/0016.

## 2026-10-02 — Permanent Vercel project names and matching domains

The user requested `stacklens` for the web project and `stacklens-api` for the separate API.
Both existing projects were renamed in place, preserving their IDs, Git integrations and approved
database-secret destinations. Readiness remains in documentation rather than the project names.
`stacklens-api.vercel.app` was assigned to the API. Vercel rejected `stacklens.vercel.app` because
another team owns it; `stacklens-web.vercel.app` was available and assigned as the web address.
The original auto-assigned domains remain compatibility aliases so existing links and deployed
rewrites continue working during the transition.

Web Production Config now points at the named API origin; routing is evaluated during the next
deployment. Before that rebuild, both new aliases passed OpenAPI, malformed/invalid/unknown API
errors, shared-contract paste/upload and quick non-persistence checks. The naming record preserves
the exact domain conflict and separates those observations from post-publication verification.
Publication CI, actual deployment source and rebuilt routing are recorded in PR #41.

The documentation-impact pass updates current README, handover, hosting/manual guides and public
acceptance links while preserving historical evidence and journey entries. Accepted requirements,
architecture boundaries, analyzer/scoring policy, UI/tokens and report schemas are unchanged.
Formatting, JSON parsing, local links, diff and staged-credential checks cover this documentation
change; existing runtime checks cover the same implementation. Worker recovery/capacity and manual
release gates remain open. The PR remains draft and unmerged.

**Traceability:** PRD-006, FR-001/003/004/022, SEC-003/007, GOV-002/006/007; ADR-0015/0016.

## 2026-10-02 — Worker interruption recovery and bounded hosting verification

The user requested the next release work after the live restart left a job waiting for stale-lock
recovery. The existing checkout receives an uncommitted follow-up on `405b420` under draft PR #41.
NFR-008 now states planned interruption/retry and confirmed-dead-owner recovery explicitly;
ADR-0017 keeps these responsibilities in Worker runtime. Provider acquisition consumes per-job
abort signals and serializes npm packuments. Zero-delay Graphile completion/failure batching makes
shutdown await queue writes before closing the pool. Integration exposed that Graphile 0.18 locks
by `pool-...`; the earlier unsaved Worker-ID helper would not identify that owner. It was never run.

The Silly launcher replaces its ts-node child with native Node before database startup, while
retaining its parent and standard streams. The selected launcher uses 96 MiB old space without
source-map loading. An uncapped workload reached memory-limit pressure; the 80 MiB experiment
stopped before completion and was rejected. The final 256 MiB/no-swap/0.25 CPU Linux experiment
completed both repositories at 244.25 MiB peak with zero memory-limit/OOM events and a clean stop.
Provider bounds, input selection, analyzer/scoring policy, contracts and UI/tokens are unchanged.

The compiled patch and launchers were uploaded to the existing approved Worker while confirmed
offline; hashes and the unchanged private runtime file were checked before recording activation.
The public web-proxy KerjaLog attempt was deliberately stopped while active. It reached offline in
22,379 ms, released its queue lock, returned to queued with `repository_analysis_interrupted` and
stored no report for the interrupted attempt. A new pool resumed attempt two; the same analysis ID
finished in 192,798 ms with five limitations and no provider failures. frey-ui finished in 147,072 ms
with 24 limitations and the same three bounded npm failures. No administrative unlock ran. A public
submission receives 24-hour expiry; neither repository was executed, built or installed.

Owned synthetic rows tested the actual remote retention pump: an expired terminal record and its
report/delivery disappeared within 6,229 ms and lookup returned 404. Expired queued/running and
legacy null-expiry rows remained, then the fixtures were removed. A consistent PostgreSQL 18 backup
restored into a separate owned Aiven database with matching application/Graphile table hashes and
eight strictly readable historical reports. API bootstrap/readback did not rewrite them. The
copied queue was not executed; the database and private dump were removed. An earlier restore
attempt rejected the target's existing empty public schema and was discarded without modifying
the preview database. This does not establish scheduled backups or disaster queue replay.

The database-backed `pnpm check` passes, including 27 Worker tests covering graceful retry, actual
child-process death before targeted unlock and preservation of a separate live owner. A parallel
cold test run also exposed API executable-test cleanup racing its async startup; the test now
awaits that continuation. API production behavior did not change. The documentation-impact pass
updates requirements/architecture versions, ADR-0017, Worker/hosting guidance, README, handover and
source-free release evidence. Vercel still runs Git revision `405b420`; Worker patch hashes do not
claim a new commit. The changes remain uncommitted/unpushed, and PR #41 remains draft/unmerged.

The user explicitly left phone/spoken screen-reader acceptance open. Another browser engine,
sustained/general capacity, Function suspension/aggregate connections and operational backup
policy remain release gates. Small measured headroom and a planned stop/start are not proof of
arbitrary workload fit, OOM recovery or automatic hosted failover.

The final read-only review covers lifecycle, provider cancellation, persisted ownership, operator
scope, launcher/package behavior and requirement/documentation traceability. No blocking issue
remains in this bounded change. Both Vercel project overviews confirm Ready on `405b420`; all remote
compiled/launcher hashes match the reviewed patch. Documentation verification checks 119 local
Markdown links, JSON parsing, current source hashes, credential patterns and a clean diff. The
temporary upload key was revoked (401 on reuse, empty dashboard list), private local files removed
and disposable test containers/databases deleted. Approved hosting runtime credentials remain.

**Traceability:** FR-003/021, NFR-008/009, SEC-001/002/003/007, GOV-002/006/007; ADR-0017.

## 2026-10-02 — Publish the verified Worker follow-up

Under the existing release-branch publication approval, the Worker source, focused regression tests,
requirements/ADR and release evidence are published together through draft PR #41. No merge is
authorized. The live capture remains explicitly based on dirty `405b420` plus file hashes, and
subsequent publication/deployment evidence is recorded separately rather than rewriting its timing
basis. The handover instructs the next session to resolve the PR's actual HEAD, CI and deployments.

The same database-backed gate and final review cover the implementation. Publication CI and both
rebuilt Vercel targets must be checked on the actual pushed commit; code behavior at the existing
Worker is identified by its verified compiled/source hashes. Manual acceptance remains open at
the user's request. Product/UI/scoring behavior and the remaining operational gates are unchanged.

**Traceability:** FR-003/021, NFR-008/009, SEC-003/007, GOV-002/006/007; ADR-0017.

## 2026-10-03 — Align responsive analysis progress

User-provided phone screenshots exposed right-aligned current-stage text alongside left-aligned
headings, and a long metadata step that moved Waiting onto a new left-aligned line. The summary
now uses left-aligned label/value text. Timeline headings reserve separate stage/status columns,
allow names to wrap and keep statuses at one right edge. Inactive rows reserve the current row's
border space, and descriptions retain the stage text's left edge.

The four existing status-view tests and database-backed `pnpm check` pass. Browser geometry checks
pass in 23 cases across all six stages and phone/tablet/desktop widths; the final 360px dark
screenshot was visually reviewed. The requested 393px override measured 394px in this browser;
the evidence records both requested and observed widths. See the
[source-bound layout record](../implementation/release-evidence/2026-10-03-progress-alignment.json).

The documentation-impact pass updates the progress design and web implementation guidance.
Accepted product behavior, architecture, tokens, analyzer policy and public API contracts do not
change. The fix is published through the existing draft PR #41; its current HEAD, CI and deployment
must be resolved for review. These screenshot corrections do not close physical-device or spoken
screen-reader acceptance, which remains open at the user's request.

**Traceability:** NFR-006/007/008, GOV-002/006/007; ADR-0006/0007.

## 2026-10-03 — Extend operational and browser release evidence

The next release pass adds Playwright acceptance in Chromium, Firefox and WebKit at desktop/320px
widths, using synthetic API responses and both report readers. The suite verifies progress geometry,
keyboard/native-file input, report/evidence focus, deep-link reload and terminal/404 polling.
Strict browser-suite typechecking, the full local gate and CI now enforce it. Local runs use one
worker after Firefox reload contention; CI uses two. Tests preserve the original timeout and run
without retries. Harness corrections cover keyboard activation, fixture disclosure order and
the actual reduced-motion configuration; product UI behavior does not change.

The live API burst observes ten peak connections against Aiven's twenty-connection limit, but its
idle count stays one above baseline. The Vercel pool now carries a constant source-free application
label for attribution. Six serial hosted repository analyses complete with contract-valid reports
in 12m 16s. Two panel samples are preserved; missing later samples do not become a cgroup/OOM pass.
A new logical restore matches seven table hashes and reads four reports; all private rehearsal
assets and its owned database are removed. The backup policy records the managed daily schedule
and the Free-plan fork restriction without activating a paid service or new credential destination.

The [dated record](../implementation/operational-preview-validation.md) distinguishes bounded
observations from cold-start/suspension, global capacity, disaster recovery and actual assistive
technology/device acceptance. The user has deferred manual checks; free built-in reader instructions
are documented. Contributor, implementation, current handover and public status documents are
updated. Accepted product behavior and architecture remain unchanged; no new ADR is required.
The follow-up uses the existing publication approval for draft PR #41; no merge is authorized.

**Traceability:** FR-002/003/004/017/021/022, NFR-006/007/008/009, SEC-001/002/003/007, GOV-002/007.

The first full gate exposed a cold persistence-barrel transform inside an API configuration test.
A two-worker experiment still failed. The unit test now uses the actual small options parser
through its mocked persistence boundary; runtime integration tests retain the full stack. Assertions,
isolation and timeouts remain unchanged. The failed runs remain separate from final verification.
