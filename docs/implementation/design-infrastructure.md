# Design Infrastructure Implementation

> **Status:** Accepted implementation baseline
> **Last reviewed:** 2026-09-19
> **Architecture:** ADR-0006, ADR-0007
> **Requirements:** FR-015–FR-021, DATA-004–DATA-005, SCORE-001–SCORE-003, NFR-002, NFR-006–NFR-007, GOV-007

## Scope

This implementation translates Design v1 into reusable production infrastructure.

It deliberately does **not** create `apps/web` or any product screen.

## Workspace

```text
packages/
├─ design-tokens/
│  ├─ scripts/build.mjs
│  ├─ tests/
│  └─ dist/                 # generated
└─ ui/
   ├─ components.json       # shadcn/Base UI configuration
   ├─ src/components/       # generic primitives
   ├─ src/domain/           # StackLens semantic components
   ├─ src/styles/
   └─ test/
```

## Token lifecycle

```text
design/tokens/stacklens.tokens.json
              ↓
packages/design-tokens/scripts/build.mjs
              ↓
      ┌───────┼────────┐
      ↓       ↓        ↓
 theme.css  tokens.js  tokens.d.ts
      ↓
packages/ui/src/styles/globals.css
```

Rules:

- edit the DTCG JSON source, never generated token files;
- run the token build after token changes;
- CI checks generated output and tests key domain semantics;
- semantic and domain tokens are preferred over raw palette references in UI components.

## shadcn/Base UI workflow

The package-level `components.json` is the shadcn configuration. It uses the Base UI `base-nova` style, Tailwind CSS v4, CSS variables, Lucide, and package `imports` aliases. Components import `cn` directly from the `cn` package; StackLens does not maintain a local utility wrapper solely to re-export it.

When a generic primitive is needed, use the repository-pinned shadcn CLI:

```sh
pnpm ui:add -- <component>
```

Then review the generated source against:

- StackLens semantic tokens;
- target sizes;
- accessible names/focus behavior;
- ADR-0006 customization rules;
- actual product need.

Do not bulk-add a component catalog before a requirement needs it.

## Current generic primitives

- `Button` — Base UI behavior plus StackLens/shadcn-style variants.
- `Badge` — semantic display primitive.

## Current domain components

- `FindingTypeBadge`;
- `SeverityBadge`;
- `ConfidenceIndicator`;
- `EvidenceCoverage`;
- `HealthScore`;
- `AnalysisLimitation`;
- `FindingCard`.

Domain APIs use product semantics rather than raw colors.

The shared stylesheet also imports the current shadcn Tailwind utilities and `tw-animate-css`, while StackLens design tokens remain the source for product colors, typography, radius, and domain semantics.

## Important boundary

`packages/ui` does not:

- calculate StackLens scores;
- decide score thresholds;
- determine finding severity;
- determine heuristic confidence;
- generate recommendations;
- infer missing evidence.

Those values must eventually come from shared report/contracts.

## Quality commands

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm check
pnpm ui:add -- <component>
```

The bootstrap CI produced and committed the first `pnpm-lock.yaml`. Normal CI uses `pnpm install --frozen-lockfile` with read-only repository permissions and pnpm caching. Third-party GitHub Actions are pinned to immutable full commit SHAs.

Generated token `dist/` output is intentionally not committed. `@stacklens/design-tokens` recreates it through `prepare` during install and through `build` in the task graph.

## Adding a domain component

1. identify the requirement/design concept it represents;
2. define a semantic API that does not encode analyzer business rules;
3. use existing generic primitives/tokens;
4. include non-color textual semantics;
5. add a focused component test;
6. document the component when it introduces a new domain pattern.

## Next step after this bootstrap

Once this quality gate is green, the lockfile is current, and generated tokens are verified, the next production layer is the shared report/domain contracts. Product screens should still wait until those contracts exist.

## TypeScript configuration boundary

`tsconfig.base.json` contains only runtime-neutral strictness rules.

Package/application configs define their own runtime behavior. The current UI package explicitly selects:

- `module: "Preserve"`;
- `moduleResolution: "Bundler"`;
- React JSX;
- DOM libraries;
- ES2024 target;
- package import/export resolution.

This prevents the shared base from accidentally imposing browser/DOM or bundler semantics on future Fastify, worker, analyzer, or CLI packages.

## Turborepo cache correctness

Root-level files that affect package tasks are included in Turbo's global hash:

- `tsconfig.base.json`;
- `design/tokens/stacklens.tokens.json`.

The test task does not declare coverage output because the current tests do not produce coverage artifacts. Declared outputs must correspond to files a task actually creates.

## Editor and agent setup

The repository includes:

- `.editorconfig` for LF endings, indentation, and the 100-column baseline;
- `.vscode/extensions.json` recommending Oxc and Tailwind CSS IntelliSense;
- `.vscode/settings.json` enabling Oxfmt/Oxlint integration and the workspace TypeScript SDK;
- root `AGENTS.md` for Codex repository instructions.

VS Code-compatible forks can consume the same workspace settings.


## Dependency and configuration policy

The repository favors the smallest durable configuration that expresses a real StackLens need:

- Node is constrained to the selected 24.x LTS major rather than accepting arbitrary future majors.
- `oxlint-tsgolint` is pinned to the mature TypeScript-7-compatible bridge release used by the repository; temporary release-age exceptions are not kept in pnpm configuration.
- Oxlint warnings fail CI, unused suppression comments are errors, and type-aware rules remain enabled without replacing `tsc` as the compiler/typechecker.
- The repository `.gitignore` lists artifacts this codebase actually produces instead of carrying a generic multi-framework template.
- Design-token tests generate their own required output before assertions so the package test is independently runnable.

## Documentation continuity

Per **GOV-007**, implementation changes are incomplete until affected durable documentation and the project journey are updated.

`docs/documentation-governance.md` defines the source-of-truth map. The root `AGENTS.md`, `CONTRIBUTING.md`, PR template, and CI journey check all reinforce that workflow.


## Runtime version ownership

`package.json` is the single source for local and CI runtime selection:

- `packageManager` declares the pnpm version consumed by `pnpm/action-setup`;
- `engines.node` declares the supported Node 24.x line consumed by `actions/setup-node`.

The workflow intentionally does not duplicate those version values, reducing configuration drift.
