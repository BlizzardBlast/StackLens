# @stacklens/design-tokens

Generated StackLens design tokens.

## Source of truth

The canonical design source is:

`/design/tokens/stacklens.tokens.json`

Do not hand-edit files under `dist/`.

## Build

```sh
pnpm --filter @stacklens/design-tokens build
```

The build produces:

- `dist/theme.css` — CSS variables plus Tailwind CSS v4 `@theme inline` aliases.
- `dist/tokens.js` — resolved token values for non-CSS consumers.
- `dist/tokens.d.ts` — minimal type declaration.

## Drift check

```sh
pnpm --filter @stacklens/design-tokens check
```

The command fails when committed generated output does not match the canonical token source.

**Traceability:** NFR-006, NFR-007, ADR-0006.
