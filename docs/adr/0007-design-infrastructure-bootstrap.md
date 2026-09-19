# ADR-0007: Design infrastructure bootstrap

- **Status:** Accepted
- **Date:** 2026-09-18
- **Last reviewed:** 2026-09-19
- **Requirements:** FR-015–FR-021, DATA-004, DATA-005, SCORE-001–SCORE-003, NFR-002, NFR-004–NFR-007, GOV-002, GOV-006, GOV-007
- **Related:** ADR-0002, ADR-0005, ADR-0006

## Context

StackLens Design v1 is accepted. Before implementing product screens, the repository needs a production design-infrastructure layer that makes the accepted visual and semantic rules reusable and testable.

The implementation start also exposed normal version drift from the architecture-planning phase. The architectural choices remain valid, but several stable tool versions have advanced since ADR-0002 was written.

## Decision

### Workspace baseline

Bootstrap the pnpm/Turborepo monorepo now, but create only the design-infrastructure packages:

- `packages/design-tokens`;
- `packages/ui`.

Do **not** create product screens in this step.

### Current implementation versions

Use the current stable implementation baseline reviewed on 2026-09-18:

- Node.js 24 LTS;
- pnpm 12.4.2;
- TypeScript 7.0.x;
- Turborepo 2.10.x;
- React 19.3;
- Tailwind CSS 4.3;
- Vitest 5.0.x;
- Base UI 1.8.x;
- Oxlint 1.83.x;
- Oxfmt 0.68.x;
- oxlint-tsgolint 7.0.2001 for stable type-aware linting;
- shadcn 4.21.x with the current `cn` helper package.

This supersedes only the stale version lines in ADR-0002. It does not change the selected architecture.

### Canonical token flow

The canonical editable source remains:

`design/tokens/stacklens.tokens.json`

A deterministic build script in `@stacklens/design-tokens` resolves DTCG aliases and generates:

- CSS semantic/custom properties;
- Tailwind CSS v4 `@theme inline` aliases;
- a resolved JavaScript token map;
- TypeScript declarations.

Generated output is checked for drift. Product code must not maintain a second hand-authored token palette.

### shadcn/Base UI boundary

`packages/ui/components.json` configures shadcn for:

- Base UI style;
- Tailwind CSS v4;
- CSS variables;
- monorepo-local aliases.

Generated shadcn source is owned by StackLens after generation. Complex generic interaction primitives should use Base UI/shadcn patterns; domain components remain StackLens-owned.

The UI package follows the current shadcn manual baseline: package `imports` aliases, Tailwind CSS v4, direct imports from `cn`, Lucide, `tw-animate-css`, and `shadcn/tailwind.css`. No local `utils.ts` abstraction exists solely to re-export `cn`. The installed CLI is invoked through the workspace rather than relying on an unpinned `@latest` command.

### Domain components do not invent product truth

The UI package receives analyzer/report semantics.

For example:
- `HealthScore` receives an explicit score state rather than deciding score thresholds;
- `FindingCard` receives classification, priority, confidence, category, and rule ID;
- N/A/unknown is represented explicitly rather than mapped to zero.

This keeps scoring and analysis decisions outside the presentation layer (**SCORE-001**, **DATA-005**).

### Quality gate

The initial quality gate runs:

1. token generation/build;
2. TypeScript type checking;
3. unit/component tests;
4. syntax and stable type-aware Oxlint rules;
5. Oxfmt check;
6. shadcn project/configuration validation;
7. pull-request journey continuity verification.

CI is the authoritative dependency/build verification for this bootstrap because the current execution sandbox used to author the repository does not have package-registry network access.

A lockfile is committed after the bootstrap install succeeds; subsequent CI installs must use `--frozen-lockfile`.

## Consequences

### Positive

- accepted Design v1 semantics are enforceable in code;
- token changes have a single source of truth;
- generic accessible primitives and product semantics have a clear boundary;
- UI components are testable before screens exist;
- analyzer/scoring truth remains outside the UI;
- future `apps/web` work starts on stable shared foundations.

### Negative

- generated token output is another artifact that must be regenerated consistently;
- shadcn-generated source still requires StackLens review/customization;
- the first implementation PR carries workspace/bootstrap configuration before visible product functionality.

These costs are accepted because they prevent screen-level implementation from bypassing the design and requirements baselines.

## References reviewed

- pnpm releases: https://github.com/pnpm/pnpm/releases
- TypeScript: https://www.typescriptlang.org/
- Vitest 5: https://vitest.dev/blog/vitest-5
- Base UI releases: https://base-ui.com/react/overview/releases
- Oxlint: https://oxc.rs/docs/guide/usage/linter
- Oxfmt: https://oxc.rs/docs/guide/usage/formatter
- shadcn monorepo: https://ui.shadcn.com/docs/monorepo


### CI and supply-chain hardening

The steady-state quality workflow uses read-only repository permissions and frozen pnpm installs.

Third-party GitHub Actions are pinned to full immutable commit SHAs. The TypeScript type-aware Oxlint bridge uses a mature pinned release compatible with the selected TypeScript line rather than retaining temporary pnpm minimum-release-age exceptions.

### Documentation is part of implementation

Per **GOV-007**, every pull request updates the project journey and every document materially affected by the change. CI enforces the journey-file update; the PR template and agent instructions enforce the broader documentation-impact review.
