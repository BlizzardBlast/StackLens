# Design Infrastructure Implementation

> **Status:** Bootstrap implementation
> **Date:** 2026-09-18
> **Architecture:** ADR-0006, ADR-0007
> **Requirements:** FR-015–FR-021, DATA-004–DATA-005, SCORE-001–SCORE-003, NFR-002, NFR-006–NFR-007

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
   ├─ src/lib/
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

The package-level `components.json` is the shadcn configuration.

When a generic primitive is needed:

```sh
cd packages/ui
pnpm dlx shadcn@latest add <component>
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
```

During the first CI bootstrap only, installation is allowed without a frozen lockfile so CI can produce the initial lockfile artifact. Once committed, CI switches to `pnpm install --frozen-lockfile`.

## Adding a domain component

1. identify the requirement/design concept it represents;
2. define a semantic API that does not encode analyzer business rules;
3. use existing generic primitives/tokens;
4. include non-color textual semantics;
5. add a focused component test;
6. document the component when it introduces a new domain pattern.

## Next step after this bootstrap

Once this quality gate is green and the lockfile/generated tokens are committed, the next production layer is the shared report/domain contracts. Product screens should still wait until those contracts exist.
