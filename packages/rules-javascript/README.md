# @stacklens/rules-javascript

Deterministic JavaScript/TypeScript normalization and analysis rules for StackLens.

## Responsibility

This package owns ecosystem-specific static interpretation that does not belong in
`@stacklens/analyzer-core`.

Implemented vertical slices are **FR-005 dependency inventory** and **FR-011 known vulnerability detection**.

It currently owns:

- validation and normalization of supported `package.json` dependency groups;
- deterministic dependency declaration ordering;
- explicit project evidence for manifest declarations;
- the `JS-DEP-005@1` fact rule;
- the minimal provider-free `JavaScriptAnalysisMetadata` shape consumed by JS/TS rules;
- the `JS-VULN-011@1` factual finding rule for exact-version OSV matches.

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

## Known vulnerability rule

`JS-VULN-011@1` is a finding rule. It does not call OSV.

The rule consumes a normalized OSV snapshot that acquisition/orchestration has already placed in
`JavaScriptAnalysisMetadata.osv`. The public metadata interface intentionally contains only the
fields the rule needs and is structurally compatible with the corresponding normalized OSV adapter
output without creating a `rules-javascript -> data-sources` dependency.

For each dependency inventory fact set, the rule:

- correlates only a query result whose package name and exact queried version equal the inventory
  fact's package name and preserved declared specifier;
- combines duplicate declarations of the same package/version into one finding basis;
- emits one factual security finding per package/version/advisory match;
- references both project declaration evidence and OSV external evidence;
- preserves stable `JS-VULN-011@1` rule identity and deterministic finding IDs;
- surfaces OSV severity only when normalized advisory metadata supplies it, attributing each record
  to its supplied severity source or OSV when no more-specific source is supplied;
- retains a known batch match even when advisory-detail metadata is unavailable;
- does not present a withdrawn advisory as an active finding;
- attaches an insufficient-evidence limitation when the OSV query result is incomplete;
- emits an insufficient/external-data limitation when exact-version query evidence, an OSV snapshot,
  a usable OSV source, or advisory evidence is unavailable;
- emits nothing for a complete empty OSV match set and never turns that state into a "secure" fact.

The rule does not define finding priority, recommendations, or score effects.

## Safety

This package performs static in-memory normalization only. It does not install dependencies,
execute package scripts, import project configuration, or perform provider/network I/O.

**Traceability:** FR-004, FR-005, FR-011, FR-017, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002.
