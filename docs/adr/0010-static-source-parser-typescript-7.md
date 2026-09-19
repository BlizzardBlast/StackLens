# ADR-0010: Static source parser compatibility under TypeScript 7

- **Status:** Accepted
- **Date:** 2026-09-19
- **Requirements:** FR-009, FR-017, DATA-003, DATA-004, NFR-001, NFR-002, NFR-004, SEC-001, SEC-002, GOV-006, GOV-007
- **Supersedes:** the initial parser implementation choice in ADR-0002 and ADR-0003
- **Related:** ADR-0007, ADR-0009

## Context

ADR-0002 and ADR-0003 selected @typescript-eslint/typescript-estree behind an internal parser
adapter for initial JavaScript/TypeScript static analysis.

The implemented StackLens baseline subsequently moved to TypeScript 7.0.2 under ADR-0007.
At the time FR-009 is being implemented, the current typescript-estree release line still requires
the TypeScript 6 compiler API and is not compatible with TypeScript 7. The upstream
typescript-eslint TypeScript 7 tracking work remains open.

Adding a dependency that is known to conflict with the repository's accepted TypeScript baseline
would make the source-analysis milestone operationally invalid. The architectural requirement is the
parser adapter and deterministic syntax-only analysis, not coupling StackLens public contracts to one
parser's AST.

## Decision

Keep the parser-adapter boundary and use @babel/parser for the initial FR-009 syntax-only
JS/TS/JSX/TSX source-reference scan.

The adapter:

- accepts already-acquired bounded source text;
- selects syntax plugins from the file extension;
- produces StackLens-owned normalized module-reference records;
- exposes parse failures and unsupported dynamic references as uncertainty;
- does not expose Babel AST types to analyzer rules;
- performs no filesystem, provider, module-resolution, or execution work.

The first supported reference forms are:

- ESM static imports;
- ESM re-exports with a static source;
- CommonJS require() with a static string argument;
- dynamic import() with a static string argument.

Non-static require() / import() expressions are not guessed. They make negative source-usage
coverage insufficient for FR-009 findings.

@babel/parser is already present in the workspace lockfile through existing tooling; the
rules package declares the exact compatible release directly so its runtime dependency is explicit.

## Consequences

### Positive

- FR-009 can be implemented without weakening the TypeScript 7 baseline.
- Parser implementation remains replaceable behind a StackLens-owned interface.
- Analyzer rules remain deterministic and parser-agnostic.
- No analyzed source is executed.
- Future migration to a TypeScript 7-native typescript-eslint/Oxc parser can occur without changing
  report contracts or FR-009 rule semantics.

### Negative

- The implementation differs from the parser named in the original ADRs.
- Syntax compatibility must be covered by StackLens fixtures rather than assumed from the TypeScript
  compiler API.
- A future parser migration will require targeted adapter regression testing.

These costs are accepted because deliberately installing a known-incompatible parser would violate
the repository's current technology baseline and quality requirements.
