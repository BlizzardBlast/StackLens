# StackLens agent instructions

These instructions apply to automated coding agents working anywhere in this repository.

## Read before changing behavior

Read the smallest relevant set of source-of-truth documents before editing code:

- `README.md` for product scope and repository status.
- `docs/requirements.md` for accepted product/system behavior.
- `CONTRIBUTING.md` for traceability and development rules.
- `docs/architecture.md` and relevant files under `docs/adr/` for architecture decisions.
- `docs/design/` and ADR-0006/ADR-0007 for design-system or UI work.

Requirements define **what** StackLens does. Architecture and implementation define **how** it does it. Do not silently create product behavior in code.

## Requirements and traceability

- Every product implementation task, PR, and acceptance test must reference applicable requirement IDs per **GOV-002**.
- If requested behavior is not covered by an accepted requirement, update the requirement first or in the same change per **GOV-003**.
- Keep architecture decisions subordinate to requirements per **GOV-006**.
- Do not encode new scoring thresholds, severities, confidence levels, recommendations, or evidence rules in presentation components.

## Workspace and commands

Use pnpm from the repository root.

Common verification commands:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm check
```

Run `pnpm check` before considering implementation work complete when the full suite is practical.

Do not replace pnpm, Turborepo, TypeScript, Oxlint, Oxfmt, Vitest, Tailwind CSS, shadcn/ui, or Base UI without an architecture decision that explains the requirement impact.

## TypeScript

- Keep `tsconfig.base.json` runtime-neutral. Runtime-specific module, lib, JSX, and target settings belong in package/app tsconfigs.
- Preserve strict mode, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `verbatimModuleSyntax`.
- The UI package is bundler-targeted and uses package `imports` aliases.
- Prefer `import type` when an import is only used as a type.
- Do not weaken compiler settings just to make a local error disappear.

## Turborepo

- Declare files outside a package that affect a task as Turbo inputs/global dependencies so cache hits remain correct.
- Only declare task outputs that are actually produced.
- Generated design-token output belongs to the `build` task.
- Keep local Turbo cache artifacts out of source control.

## shadcn/ui and Base UI

StackLens owns its visual language. shadcn/ui is source scaffolding for generic accessible primitives; Base UI is the preferred primitive layer for new complex interactions.

- shadcn configuration lives at `packages/ui/components.json`.
- Add a component from the repository root with:

  ```sh
  pnpm ui:add -- <component>
  ```

- Review generated source before committing it.
- Map generated components to StackLens semantic tokens and sizing/accessibility rules.
- Do not bulk-add unused components.
- Do not hand-build dialogs, menus, popovers, selects, comboboxes, tooltips, or tabs when the accepted primitive can satisfy the requirement.
- Generic reusable primitives belong in `packages/ui/src/components/`.
- StackLens-specific semantics belong in `packages/ui/src/domain/`.

## Design tokens

The canonical editable token source is:

`design/tokens/stacklens.tokens.json`

Do not hand-edit `packages/design-tokens/dist/`. It is generated and ignored by Git.

When tokens change, run the build and tests. Product UI should consume semantic/domain tokens rather than raw palette values whenever a semantic token exists.

## Analyzer safety

Analyzed repositories are untrusted input.

Per **SEC-001** and **SEC-002**, MVP analysis must not execute arbitrary repository code, package scripts, builds, tests, hooks, or dependency installation.

Do not introduce an execution path that violates this boundary.

## Tests and quality

- Add focused tests for new behavior.
- Analysis rules must be independently testable.
- Heuristics must cover both positive findings and insufficient-evidence cases.
- UI accessibility semantics must not rely on color alone.
- Fix lint/type/test failures at the source instead of suppressing them globally unless the rule is genuinely inappropriate for the repository.

## Documentation completion gate

Documentation is part of the change. Before reporting work as complete, every agent must perform a documentation-impact pass according to `docs/documentation-governance.md`.

For **every pull request**:

- append the chronological step to `docs/design/journey.md`;
- state what changed, why, and meaningful verification;
- update `docs/requirements.md` when accepted behavior changes;
- update architecture/ADRs when architecture or technology decisions change;
- update design documents when tokens, UI semantics, accessibility patterns, or interaction decisions change;
- update implementation/contributor/agent documentation when tooling, CI, packages, editor setup, or workflow changes;
- update `README.md` when its public status or guidance would become stale.

Do not finish with knowingly stale documentation. Do not rewrite historical journey entries to hide earlier decisions; append corrections as new steps.

## Generated and historical artifacts

- `design/prototype/` is disposable design-validation code, not production implementation.
- The project-wide journey lives at `docs/design/journey.md`; append every PR as a new chronological step rather than rewriting history.
- Generated token output is recreated by package scripts and is not a second source of truth.
