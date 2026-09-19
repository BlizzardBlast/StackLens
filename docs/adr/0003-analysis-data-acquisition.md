# ADR-0003: Repository acquisition and evidence providers

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** PRD-001–PRD-004, FR-003, FR-005–FR-017, FR-021, DATA-001–DATA-006, SCORE-003, SEC-001, SEC-002, SEC-007, SEC-008, NFR-001–NFR-004, GOV-006

## Context

StackLens must make evidence-backed deterministic findings without executing analyzed repositories.

Repository analysis needs enough information to detect:

- declared dependencies;
- resolved versions when available;
- source-level dependency references;
- supported framework/tool/configuration signals;
- known vulnerabilities;
- migration opportunities.

External package/advisory data can fail, change over time, or have different semantics. Those facts must be preserved in provenance rather than hidden behind a generic API result.

## Decision

### Repository acquisition

Use the **GitHub REST API** for MVP public-repository acquisition.

The acquisition process must:

1. validate that the input is a supported GitHub repository URL;
2. resolve the requested/default branch to an immutable commit SHA;
3. enumerate repository paths through GitHub APIs;
4. retrieve only bounded, supported text files needed by enabled rules;
5. build a normalized `ProjectSnapshot`;
6. discard transient file contents after analysis unless a separately accepted retention requirement says otherwise.

Do not clone and execute repositories as part of MVP analysis.

### File selection

The repository snapshot layer uses an explicit allowlist/selection strategy rather than downloading everything indiscriminately.

Initial high-value files include:

- root `package.json`;
- supported lockfiles;
- package-manager/workspace metadata;
- TypeScript/JavaScript configuration;
- Vite/webpack/other supported tool configuration;
- test/lint/format configuration;
- GitHub Actions configuration when a rule explicitly needs it;
- supported JavaScript/TypeScript/JSX/TSX source files for static import/reference analysis.

The acquisition implementation must enforce configurable limits for:

- maximum file size;
- maximum number of files;
- maximum total bytes;
- request/network timeout;
- analysis duration.

Files skipped due to limits or unsupported types become report limitations.

### Lockfiles and exact versions

Known-vulnerability matching requires sufficiently precise version evidence.

For repository analysis, StackLens should statically parse supported lockfiles to obtain resolved package versions when possible.

For quick `package.json` analysis:

- an exact declared version may be used as exact version evidence;
- a semver range such as `^1.2.3` must **not** be silently treated as the installed version;
- when an exact installed version cannot be established, vulnerability checks that require it must report insufficient evidence rather than infer a result.

This is required by **PRD-004**, **FR-011**, and **SCORE-003**.

### JavaScript/TypeScript source analysis

Use `@typescript-eslint/typescript-estree` behind a parser adapter for initial JS/TS/JSX/TSX static analysis.

Initial source-reference detection may consider:

- ESM static imports/exports;
- CommonJS `require()` with static string arguments;
- dynamic `import()` with static string arguments;
- known configuration/plugin references where explicitly supported.

The analyzer must not claim a dependency is unnecessary merely because a simple import search did not find it. Rule logic must account for scripts, configuration, framework conventions, generated usage, plugins, and unsupported dynamic references. Unnecessary-dependency findings are therefore heuristic unless stronger evidence exists (**FR-009**, **DATA-004**).

### npm Registry adapter

Use the public npm registry as the initial authoritative package-metadata provider for:

- published versions;
- distribution tags where relevant;
- explicit package deprecation metadata;
- package repository metadata when available;
- publication/version timestamps where needed by a supported rule.

Normalize npm responses into StackLens-owned contracts before rule execution.

### OSV adapter

Use **OSV.dev** as the initial vulnerability provider.

Use batch package/version queries where possible.

The adapter must preserve:

- OSV/advisory identifiers;
- affected package/version evidence;
- severity when supplied by the underlying record/source;
- references;
- modified/published timestamps;
- retrieval timestamp.

Absence of returned vulnerabilities means only that no matching known vulnerability was returned for the provided evidence. It is not proof of security (**FR-011**).

### GitHub metadata

GitHub repository metadata may also support evidence such as:

- repository archive state;
- repository existence/visibility;
- commit/reference identity;
- dependency repository links where a supported rule explicitly needs them.

Maintenance heuristics must not convert generic activity thresholds into an authoritative "unmaintained" fact. Explicit deprecation/archive declarations and heuristics are represented separately (**FR-007**, **PRD-003**).

## Provider boundary

Each provider exposes a StackLens-owned adapter interface.

Conceptually:

```ts
interface EvidenceProvider<TRequest, TResponse> {
  readonly id: string;
  fetch(
    request: TRequest,
    context: ProviderContext,
  ): Promise<
    { ok: true; data: TResponse; retrievedAt: string } | { ok: false; failure: ProviderFailure }
  >;
}
```

Analyzer rules consume normalized evidence rather than provider-specific HTTP responses.

## Caching

External metadata may be cached, but cached records must retain:

- source;
- source timestamp when available;
- retrieval timestamp;
- cache observation timestamp.

Caching must not erase the provenance required by **DATA-001** and **DATA-002**.

## Failure behavior

Provider failure is typed and scoped.

Examples:

- npm unavailable -> dependency inventory can still succeed, but outdated/deprecation findings may be unavailable;
- OSV unavailable -> vulnerability findings are unavailable and Security scoring must reflect insufficient evidence rather than a perfect score;
- some source files exceed limits -> supported manifest/config findings can still complete, with source-analysis limitations.

This implements **NFR-003** and **PRD-004**.

## Consequences

### Positive

- strong security boundary;
- no repository code execution;
- reproducible commit-scoped repository analysis;
- evidence provenance is explicit;
- providers can be replaced or supplemented later;
- source-level heuristics can be conservative.

### Negative

- GitHub API rate limits and file retrieval cost must be managed;
- static analysis cannot perfectly model runtime/plugin behavior;
- lockfile parsers add ecosystem-specific complexity;
- large repositories may produce partial analysis due to safety limits.

These limitations are acceptable because StackLens must prefer honest uncertainty over unsupported certainty.
