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
