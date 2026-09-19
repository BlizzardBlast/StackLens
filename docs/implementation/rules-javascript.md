# JavaScript Rules

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, NFR-005, SEC-001, SEC-002, GOV-007
> **Related decisions:** ADR-0008, ADR-0009

## Package responsibility

`packages/rules-javascript` contains JavaScript/TypeScript-specific deterministic normalization
and analyzer rules.

It depends only on:

- `@stacklens/analyzer-core`;
- `@stacklens/contracts`.

Provider/network work remains outside the package.

## FR-005 dependency inventory

The first vertical slice normalizes these supported `package.json` groups:

- `dependencies`;
- `devDependencies`;
- `peerDependencies`;
- `optionalDependencies`.

A normalized dependency declaration contains:

- dependency name;
- exact declared specifier string;
- dependency group.

Group order is fixed and dependency names are code-unit sorted, making equivalent manifest objects
produce equivalent normalized snapshots. Declarations are not merged across groups.

Malformed dependency groups or non-string declaration values throw validation errors rather than
being silently coerced (**FR-004**).

## Evidence

Each normalized declaration can produce one deterministic `ProjectEvidence` record.

Evidence identifies `package.json` but does not invent line numbers. Stable evidence identity is
derived from group, dependency name, and declared specifier.

No `DataSource` is created because FR-005 uses only local project evidence.

## Fact rule

`JS-DEP-005@1` is a fact rule.

For each normalized declaration it emits one `dependency.inventory` fact with:

- dependency name in the generic subject;
- `details.kind = "dependency_inventory"`;
- structured dependency group;
- structured exact declared specifier;
- the matching project-evidence ID.

The rule emits no finding candidates, priority, recommendations, or scores.

## Analyzer integration

The integration fixture passes:

`normalized manifest → project evidence → JS-DEP-005 → analyzer-core → AnalysisReport`.

Because FR-005 alone does not justify a product health score, the fixture uses an explicit
insufficient-evidence score state. The test prioritizer is inert because the rule emits no finding
candidates.

## Safety boundary

The implementation is static and synchronous. It does not:

- install analyzed dependencies;
- run package lifecycle scripts;
- execute builds or tests;
- import project configuration;
- access npm/OSV/GitHub providers.

This preserves **SEC-001** and **SEC-002**.
