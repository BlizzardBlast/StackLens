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

A new `JavaScriptAnalysisMetadata` interface defines only the OSV fields the rule needs. The shape is
structurally compatible with the normalized OSV adapter snapshot while preserving the accepted
package direction:

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
- references all matching project declaration evidence plus OSV external evidence;
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

Focused tests cover active findings, duplicate declarations, severity attribution, detail-unavailable
matches, withdrawn advisories, incomplete query coverage, complete empty results, range declarations,
unavailable/missing OSV data, missing external advisory evidence, unrelated query results,
deterministic ordering, and analyzer-core integration.

**Traceability:** FR-011, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003,
NFR-004, SEC-002, GOV-002, GOV-006, GOV-007.
