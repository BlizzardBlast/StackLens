# @stacklens/rules-javascript

Deterministic JavaScript/TypeScript normalization and analysis rules for StackLens.

## Responsibility

This package owns ecosystem-specific static interpretation that does not belong in
`@stacklens/analyzer-core`.

The first implemented vertical slice is **FR-005 dependency inventory**.

It currently owns:

- validation and normalization of supported `package.json` dependency groups;
- deterministic dependency declaration ordering;
- explicit project evidence for manifest declarations;
- the `JS-DEP-005@1` fact rule.

It does not own:

- npm, OSV, or GitHub network requests;
- repository acquisition;
- finding priority policy;
- recommendations;
- health-score formulas;
- API, worker, database, or UI behavior.

## Normalized manifest

`normalizePackageManifest` accepts already-parsed JSON input and preserves the exact dependency
specifier string.

Supported dependency groups are:

- `dependencies`;
- `devDependencies`;
- `peerDependencies`;
- `optionalDependencies`.

Groups are evaluated in that fixed order and dependency names are sorted with code-unit ordering.
The same package may therefore appear more than once when it is meaningfully declared in multiple
groups. Those declarations are never silently merged.

Malformed groups and non-string dependency values are rejected rather than coerced (**FR-004**).

## Evidence and facts

`createDependencyInventoryEvidence` creates one `ProjectEvidence` record per normalized
declaration with `package.json` as its path. It does not fabricate line numbers.

Evidence and fact IDs are derived deterministically from dependency group, name, and declared
specifier.

The `JS-DEP-005@1` fact rule emits `dependency.inventory` facts whose:

- subject name is the dependency name;
- structured `details.dependencyGroup` preserves the manifest group;
- structured `details.declaredSpecifier` preserves the exact declared string;
- evidence reference resolves to the matching project evidence.

The rule emits no finding, priority, recommendation, or scoring policy.

## Safety

This package performs static in-memory normalization only. It does not install dependencies,
execute package scripts, import project configuration, or perform provider/network I/O.

**Traceability:** FR-004, FR-005, FR-017, NFR-001, NFR-002, NFR-004, NFR-005, SEC-001, SEC-002.
