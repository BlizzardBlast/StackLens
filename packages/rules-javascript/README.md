# @stacklens/rules-javascript

Deterministic JavaScript/TypeScript normalization and analysis rules for StackLens.

## Responsibility

This package owns ecosystem-specific static interpretation that does not belong in
`@stacklens/analyzer-core`.

Implemented vertical slices are **FR-005 dependency inventory**, **FR-006 outdated dependency detection**, **FR-007 explicit deprecation detection**, **FR-008 dependency overlap**, **FR-010 npm Registry health signals**, **FR-011 known vulnerability detection**, **FR-012 framework/tool detection**, and **FR-013 project configuration detection**.

It currently owns:

- validation and normalization of supported `package.json` dependency groups;
- deterministic dependency declaration ordering;
- explicit project evidence for manifest declarations;
- the `JS-DEP-005@1` fact rule;
- the minimal provider-free `JavaScriptAnalysisMetadata` shape consumed by JS/TS rules;
- `JS-NPM-006@1` factual outdated-dependency findings for exact SemVer declarations;
- `JS-NPM-007@1` factual explicit npm deprecation findings;
- `JS-NPM-010@1` neutral npm Registry health-signal facts;
- the `JS-VULN-011@1` factual finding rule for exact-version OSV matches;
- `JS-OVERLAP-008@1` curated medium-confidence dependency-overlap heuristics;
- `JS-TOOL-012@1` manifest-backed framework/tool facts;
- `JS-CONFIG-013@1` repository-only static configuration facts/limitations;
- a small `JavaScriptProjectSnapshot` abstraction for already-acquired static repository files.

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

The rule consumes source-bound OSV metadata that acquisition/orchestration has already placed in
`JavaScriptAnalysisMetadata.osv`. The wrapper contains the report-level OSV `sourceId` plus a
minimal `snapshot`; that inner snapshot intentionally contains only the fields the rule needs and is
structurally compatible with the corresponding normalized OSV adapter data without creating a
`rules-javascript -> data-sources` dependency.

For each dependency inventory fact set, the rule:

- correlates only a query result whose package name and exact queried version equal the inventory
  fact's package name and preserved declared specifier;
- combines duplicate declarations of the same package/version into one finding basis;
- emits one factual security finding per package/version/advisory match;
- requires the metadata's bound `sourceId` to resolve to the exact usable report-level OSV
  `DataSource`;
- references both project declaration evidence and OSV external evidence from that exact source;
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

## npm Registry metadata rules

The npm-backed rules do not call npm. Acquisition/orchestration supplies
`JavaScriptAnalysisMetadata.npmRegistry` as a list of source-bound normalized package snapshots.
Each snapshot is tied to one exact report-level `DataSource.id`, and any external evidence used by a
rule must reference that same source.

### Outdated dependency detection

`JS-NPM-006@1` is a factual finding rule for **FR-006**.

The first supported comparison basis is intentionally conservative:

- the project declaration must be an exact Semantic Version;
- the same exact declared version must exist in the normalized npm Registry version records;
- the comparison version is npm's normalized `latest` dist-tag;
- that comparison version must also exist as a normalized version record;
- both versions must be supported exact Semantic Versions.

Ranges, tags, URLs, workspace protocols, and other non-exact specifiers are preserved as declarations
but produce an insufficient-evidence limitation until resolved-version evidence exists. They are
never silently treated as installed versions.

When `latest` is newer, the rule emits one factual finding per package/exact declared
version/comparison version. Duplicate dependency-group declarations of the same exact version share
one finding basis while preserving all contributing inventory facts and project evidence.

The description distinguishes:

- major-version differences;
- minor-version differences;
- patch-version differences;
- prerelease-to-release differences when the numeric core is unchanged.

No production priority, recommendation, or score effect is encoded by this rule.

### Explicit npm deprecation

`JS-NPM-007@1` is a factual finding rule for the mandatory explicit-deprecation portion of
**FR-007**.

The rule requires an exact declared Semantic Version and selects that exact normalized npm version
record. A non-empty provider deprecation message produces a factual finding with project evidence and
the exact bound npm Registry evidence.

The rule does **not** currently emit an "unmaintained" heuristic. FR-007 permits, but does not require,
that heuristic, and StackLens has not accepted a deterministic maintenance threshold/basis yet.
Avoiding an invented threshold keeps authoritative deprecation facts separate from future heuristic
maintenance interpretation.

### npm Registry health signal

`JS-NPM-010@1` is a fact rule for **FR-010**.

For each declared package with usable source-bound npm metadata, it emits one neutral
`dependency.health.npm_registry` fact containing supported verifiable metadata such as:

- npm `latest` dist-tag version;
- that release's publication timestamp when supplied;
- registry metadata modification timestamp when supplied.

The rule intentionally does not label those timestamps "healthy", "stale", "active", or
"unmaintained". A future combined health interpretation must define and disclose its accepted
deterministic rule before assigning such meaning.

### Missing and partial npm evidence

All npm-backed rules are conservative:

- missing normalized package metadata → insufficient-evidence limitation;
- multiple snapshots for one package → ambiguous/insufficient-evidence limitation;
- missing, unavailable, non-npm, or mismatched bound source → external-data limitation;
- external evidence not tied to the exact bound source/reference → external-data limitation;
- partial source → observed positive facts/findings may still be emitted, but a partial-failure
  limitation is retained;
- missing declared/comparison version records → external-data limitation;
- complete usable metadata with no newer `latest` version → no outdated finding;
- complete usable exact-version metadata without a deprecation message → no deprecation finding.

Absence of a finding is not promoted into a generic package-health conclusion.

## Dependency overlap

`JS-OVERLAP-008@1` implements **FR-008** as a heuristic finding rule over dependency-inventory
facts.

The first supported overlap catalog is intentionally explicit and narrow:

- Biome + ESLint for linting;
- Biome + Prettier for formatting;
- Axios + Ky for HTTP-client responsibilities;
- Day.js + Moment for date/time utilities;
- Jest + Vitest for test-runner responsibilities.

A match requires both exact package identities to be declared. The rule does not infer overlap from
a broad category or package-name similarity.

Each finding:

- names both packages and the specific overlapping capability;
- explains why parallel ownership can matter;
- preserves every contributing dependency fact/evidence record;
- is classified as a medium-confidence heuristic;
- explicitly states that co-declaration does not establish that either package is unnecessary.

The rule does not recommend removing either dependency and does not set production priority/score
policy.

## Framework and tool detection

`JS-TOOL-012@1` implements **FR-012** from deterministic manifest evidence.

A curated package catalog identifies supported frameworks/tools such as Next.js, Angular, SvelteKit,
Vite, webpack, Rollup, esbuild, Vitest, Jest, Playwright, Cypress, ESLint, Prettier, Biome,
TypeScript, selected state-management libraries, and selected observability SDKs.

Detection requires an exact supported package name in a normalized dependency group. Unknown
packages are not guessed from names or broad categories. Duplicate declarations produce one tool
fact while preserving all declaration evidence.

## Static project snapshot

Repository-oriented rules use `JavaScriptProjectSnapshot`, which extends the normalized manifest
with optional already-acquired static files.

`createJavaScriptProjectSnapshot`:

- accepts file content already supplied by an acquisition layer;
- validates canonical relative POSIX paths;
- rejects absolute/backslash/control-character/dot-segment paths and duplicate paths;
- sorts files deterministically;
- performs no filesystem or network I/O.

This helper is not a GitHub acquisition adapter; Milestone G will provide bounded repository
acquisition separately.

## Project configuration detection

`JS-CONFIG-013@1` implements the static rule layer for **FR-013**.

Supported declarative files currently include:

- `tsconfig.json` and simple `tsconfig.*.json` names;
- `.eslintrc.json`;
- `.prettierrc` / `.prettierrc.json`;
- `biome.json` / `biome.jsonc`.

Strict JSON inputs can expose a bounded allowlist of high-level characteristics such as TypeScript
strictness/module/target, ESLint extends/plugins/rule counts, Prettier formatting options, and
Biome formatter/linter/assist enablement.

Known JavaScript/TypeScript configuration files such as Vite, Vitest, webpack, Rollup, Jest, ESLint
flat config, Next.js, Prettier, and Tailwind config are identified by path only. Their code is never
imported, executed, or evaluated; a rule limitation records that inspection is partial.

JSONC/comments, malformed/unsupported shapes, and configuration content above the 512 Ki-character
inspection bound remain detected as files but produce unsupported/resource-limit limitations rather
than guessed characteristics.

Project evidence stores only configuration path/summary metadata, never configuration source
content.

## Safety

This package performs static in-memory normalization only. It does not install dependencies,
execute package scripts, import project configuration, or perform provider/network I/O.

**Traceability:** FR-004, FR-005, FR-006, FR-007, FR-008, FR-010, FR-011, FR-012, FR-013, FR-017, FR-021, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002.
