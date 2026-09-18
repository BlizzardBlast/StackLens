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

The command fails when the generated output currently on disk does not match the canonical token source. Generated `dist/` files are intentionally ignored by Git and are recreated by the package `prepare`/`build` scripts.

**Traceability:** NFR-006, NFR-007, ADR-0006.


## Generated output policy

`dist/` is generated and intentionally not committed. The package `prepare` script creates it during workspace installation, and `build` regenerates it in CI/build pipelines.

This keeps the DTCG JSON as the only version-controlled token source while still making package exports available after a normal install.
