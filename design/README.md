# StackLens Design Artifacts

This directory contains machine-readable and executable design artifacts.

- `tokens/stacklens.tokens.json` — canonical design-phase token source.
- `tokens/tokens.css` — reference CSS mapping for the prototype.
- `prototype/index.html` — disposable interactive product prototype.

Human-readable design rationale and journey documentation live in [`docs/design/`](../docs/design/README.md).

## Preview the prototype

The prototype is static and has no package dependencies.

From the repository root, serve the directory with any local static HTTP server and open `design/prototype/index.html` through that server.

For example, once implementation tooling exists, a repository script may be added for this purpose. Until then, this artifact deliberately remains independent from the production application.

## Important

The coded prototype is **not production code**. Do not import it into `apps/web`. Recreate accepted design patterns using `packages/design-tokens`, `packages/ui`, shared contracts, and the production application architecture.
