# Web bundle-size experiments (opt-in)

**Traceability:** GOV-002 and GOV-007. This is a local developer-tooling measurement,
not a new product requirement, build gate, or user-facing performance guarantee.

StackLens's MVP release recorded a **historical** Vite warning of 510.88 kB minified
/ 155.27 kB gzip for a web chunk. Those numbers are **not** a current baseline,
and a single chunk is not the same thing as total initial page transfer.
The Clarity team's [October 2026 case study](https://clarity.microsoft.com/blog/how-we-made-clarity-js-smaller/)
shows why a source-size change must be evaluated against compressed production
output before claiming a network-size improvement.

## Capture and compare

Run from the repository root, with the project's pinned Node/pnpm versions:

First, create a comparable baseline (the Node command for creating `.cache` works
in Windows PowerShell, Command Prompt, and POSIX shells):

```sh
pnpm build
node -e "require('node:fs').mkdirSync('.cache', { recursive: true })"
node scripts/web-bundle-size.mjs > .cache/web-bundle-baseline.json
```

Make one candidate change, preserve the baseline file, and then run:

```sh
pnpm build
node scripts/web-bundle-size.mjs --compare .cache/web-bundle-baseline.json
```

The script measures the built `apps/web/dist` tree by default (override with
`--dir BUILD_DIR`). It emits deterministic JSON with each `.js` and `.css`
asset's raw byte count and Node zlib gzip byte count. To bound memory and file
handles, the tool enumerates directories sequentially and streams files through
zlib in batches of at most four active pipelines; it does not retain whole
file contents. Totals sum **individually gzipped files**, grouped into JS, CSS,
and both. The comparison reports signed
raw/gzip byte deltas; a negative delta means fewer bytes. Hashed filenames
are not treated as stable identifiers across builds. Source maps, HTML, fonts,
images, HTTP headers, CDN compression choices and browser caching are outside
this metric. Sum of all JS chunks is **not** initial-load JS: route splitting,
which chunks a user requests and cache behavior matter. Use a browser/network
trace for a real page-load claim.

The command fails for missing build assets, unreadable output, symlinks at the
selected output root or below it, or a malformed/inconsistent comparison snapshot.
Symlinks/junctions in **ancestor directories** of the selected output root are
resolved normally by the operating system; the directly selected root entry
and descendants are checked. This is a build-measurement integrity guard, not
a filesystem sandbox for hostile or concurrently modified directories.

It **does not fail on an increase**, impose an arbitrary budget or create files/network
requests on its own; shell redirection
is an operator choice. Do not commit `.cache` results or automatically run
large optimization loops in CI. Run focused fixture checks via:

```sh
node --test scripts/web-bundle-size.test.mjs
```

The ordinary `test:deployment` command includes these deterministic tests,
without adding a separate workflow or a production build to that test step.
The fixtures include a 12 MiB asset compared to `gzipSync`, multiple batches of
assets and a symlinked nested directory. Windows symlink fixture tests explicitly
skip only when the operating system denies symlink creation with `EPERM` or
`EACCES`; other filesystem errors are not skipped.

## Bounded change / build / measure / verify loop

1. Record the baseline revision, lockfile and tool versions, production build
   mode, environment and the exact comparison command. Keep build conditions
   equivalent; when they differ materially, don't report a causal byte saving.
2. Try **one hypothesis** at a time. Start with unusually large or eagerly
   loaded chunks and imports whose module namespaces become runtime objects.
   A property-only namespace import may already tree-shake. Inspect what the
   actual Vite/Rolldown toolchain emits before applying Rollup-specific advice.
3. Measure gzip **and** inspect the before/after asset list. Only count
   improvements for builds with matching behavior and supported browsers.
   Test explicit alternatives (dependency replacement, lazy-loading, tree
   shaking) before micro-refactoring strings or syntactic sugar.
4. Run the existing typecheck, unit, browser and accessibility gates relevant
   to the change. Preserve required quality/security checks, compatibility,
   maintainability and SOLID boundaries. A gzip win that breaks functionality
   or materially hurts clarity does **not** qualify.
5. Keep the change only when evidence justifies the tradeoff; otherwise
   revert. Record negative and neutral experiments, including environment and
   test evidence, in the PR. Batch locally validated experiments into a single
   reviewed PR to minimize CI consumption.

Do not copy Clarity's ES5-specific template-literal rewrites, its Terser
settings or its discarded ES2017 target change into StackLens by default:
StackLens uses a different build toolchain, modern browser target and runtime
compatibility contract. Any minifier or target change needs its own tests and
measurements. The script is deliberately an **observer**, not an autonomous
source editor or merge decision-maker.
