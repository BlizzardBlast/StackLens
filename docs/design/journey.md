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
bounded to 512 KiB.

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
