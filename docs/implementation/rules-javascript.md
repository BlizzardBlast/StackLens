# JavaScript Rules

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-017, FR-021, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-007
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


## FR-011 known vulnerability finding

The second JavaScript/TypeScript rule slice consumes already-acquired OSV metadata through the
analyzer's generic metadata snapshot. It does not add a dependency on `@stacklens/data-sources` and
does not perform network I/O.

The rule package exposes a minimal readonly `JavaScriptAnalysisMetadata` interface. Its OSV subset
is source-bound:

```ts
{
  sourceId: string;
  snapshot: JavaScriptOsvSnapshot;
}
```

The inner snapshot contains:

- exact package/version query results;
- advisory IDs returned for each query;
- whether each query result is complete;
- optional normalized advisory detail required for withdrawal/severity interpretation.

The inner snapshot is deliberately narrower than the provider DTO but structurally compatible with
the normalized OSV adapter data. The wrapper's `sourceId` binds that snapshot to one exact
report-level OSV `DataSource`. Acquisition/orchestration remains responsible for constructing the
wrapper from the provider result and for supplying the matching `DataSource`,
`ExternalEvidence`, and `PartialFailure` records.

### Correlation basis

`JS-VULN-011@1` runs after `JS-DEP-005@1`.

It groups dependency inventory facts by:

```text
package name + exact preserved declared specifier
```

A normalized OSV query result is usable for the current quick-manifest slice only when its package
name and queried version exactly equal that fact basis.

This intentionally means declarations such as `^4.17.20` do not match an OSV result for
`4.17.20`. Until an explicit resolved-version source is introduced, such declarations remain
insufficient evidence rather than being silently treated as installed versions.

### Factual findings

For each usable OSV batch match the rule emits one factual finding keyed by:

```text
package + exact queried version + advisory ID
```

Duplicate manifest declarations of the same package/version are represented by one finding whose
`factIds` and project evidence cover all matching declarations.

Every emitted finding:

- uses the `security` category;
- identifies the dependency through the generic finding subject;
- names the advisory in the finding text;
- requires the bound OSV `sourceId` to resolve to one usable report-level OSV source;
- references project dependency evidence and OSV external evidence whose `sourceId` matches that
  bound source exactly;
- uses stable rule identity `JS-VULN-011@1`;
- carries traceability for **FR-011**, **DATA-001**, **DATA-002**, and **DATA-003**.

This is a factual detection rule. It does not set priority or create recommendations.

### Severity

If normalized advisory detail contains severity metadata, the finding description preserves up to a
bounded deterministic summary of source-provided severity records.

A severity record with a provider-supplied `source` is attributed to that source. If the normalized
record has no more-specific source, the description attributes it to OSV rather than presenting the
severity as StackLens's own assessment.

The rule does not translate CVSS vectors/scores into StackLens severity labels and does not affect
health scoring.

### Missing, partial, and withdrawn evidence

The rule is conservative:

- no usable OSV source → external-data limitation;
- usable OSV source but no normalized snapshot → insufficient-evidence limitation;
- no exact package/version query result → insufficient-evidence limitation;
- incomplete query result → known matches may still become findings, but the finding references an
  insufficient-evidence limitation stating that additional matches may be missing;
- batch match without advisory detail → finding remains valid because the exact-version batch match
  is authoritative; severity/withdrawal detail is simply unavailable;
- withdrawn advisory detail → no active vulnerability finding is emitted and an external-data
  limitation explains the withdrawal;
- batch match without usable OSV `ExternalEvidence` from the snapshot's exact bound source → no
  finding is emitted because provenance would be incomplete;
- snapshot bound to a missing, non-OSV, or unavailable report source → no finding is emitted and an
  external-data limitation explains the source mismatch;
- complete query result with zero matches → no vulnerability finding and no "secure" fact.

Provider partial failures remain report-level acquisition artifacts supplied before analyzer
execution.

### Analyzer integration

The integration fixture runs:

```text
normalized manifest
  → dependency project evidence
  → JS-DEP-005 facts
  → normalized OSV metadata + OSV source/evidence
  → JS-VULN-011 finding candidate
  → test-only prioritizer
  → contract-valid AnalysisReport
```

The prioritizer and scorer in the fixture are explicitly test-only. This slice does not introduce a
production priority formula or scoring policy.

### Verification

Focused tests cover:

- exact-version factual finding creation;
- OSV/project provenance and stable rule identity;
- deterministic finding IDs/order;
- duplicate declarations;
- top-level and affected-package severity attribution;
- detail-unavailable batch matches;
- withdrawn advisories;
- incomplete query coverage;
- complete empty query results;
- range declarations without exact query evidence;
- unavailable source and missing snapshot states;
- missing advisory evidence;
- advisory evidence from a different OSV source;
- snapshot bound to a missing/unavailable source;
- unrelated provider query results;
- analyzer-core contract integration.

No live network access is used.


## npm Registry metadata rules

The next provider-backed slice consumes already-normalized npm Registry metadata through
`JavaScriptAnalysisMetadata.npmRegistry`. It adds no provider/network I/O and no
`rules-javascript -> data-sources` dependency.

Each normalized entry contains:

```ts
{
  sourceId: string;
  snapshot: {
    packageName: string;
    registryCreatedAt?: string;
    registryModifiedAt?: string;
    distTags: { tag: string; version: string }[];
    versions: {
      version: string;
      deprecatedMessage?: string;
      publishedAt?: string;
    }[];
  };
}
```

The snapshot is deliberately limited to fields used by the current rules and is structurally
compatible with the corresponding normalized npm Registry adapter output. The wrapper binds that
snapshot to the report-level npm Registry `DataSource`.

Shared npm-rule support requires:

- exactly one normalized snapshot for the analyzed package;
- a bound source whose provider is `npm-registry` and whose state is usable;
- external evidence tied to the same source and, when supplied, the same source reference.

Partial sources remain usable for observed positive evidence but produce a rule-specific
`partial_failure` limitation.

### FR-006 outdated dependency finding

`JS-NPM-006@1` compares exact project declarations with npm's `latest` dist-tag.

Supported factual comparison requires all of the following:

1. the declared specifier parses as an exact Semantic Version;
2. the exact declared version exists in the normalized registry version records;
3. a `latest` dist-tag exists;
4. the version named by `latest` exists in the normalized registry version records;
5. the comparison value is also a supported exact Semantic Version.

The rule implements Semantic Version precedence for numeric major/minor/patch parts and prerelease
identifiers. Build metadata does not affect precedence.

If `latest` is newer, one factual finding is emitted for the package/declaration/comparison tuple.
The finding description explicitly identifies the declared version, comparison version, npm
Registry basis, and whether the difference is major, minor, patch, or prerelease-to-release.

If the declaration is a range/tag/URL/workspace or otherwise not an exact supported Semantic Version,
the rule emits an insufficient-evidence limitation rather than interpreting it as an installed
version.

This slice does not resolve lockfiles and does not claim that the `latest` release is automatically a
safe or recommended upgrade.

### FR-007 explicit deprecation finding

`JS-NPM-007@1` implements the mandatory explicit-deprecation portion of FR-007.

The rule:

- requires an exact declared Semantic Version;
- requires the exact normalized registry version record;
- treats a provider-supplied non-empty `deprecatedMessage` as factual evidence;
- emits one factual dependency finding with the exact npm source/evidence and all matching project
  dependency-inventory facts.

It does not emit an "unmaintained" heuristic. That portion of FR-007 is optional ("may identify"),
and no accepted deterministic threshold currently defines inactivity as unmaintained. Introducing
such a heuristic later requires an explicit basis, confidence, positive fixtures, and
insufficient-evidence fixtures per DATA-004/NFR-002.

### FR-010 neutral npm health signal

`JS-NPM-010@1` emits one package-level `dependency.health.npm_registry` fact when the normalized
npm snapshot provides a valid `latest` record.

The fact can state:

- the `latest` dist-tag version;
- the latest version publication timestamp when available;
- package metadata modification time when available.

These are neutral verifiable signals, not a combined health score or maintenance judgment. No
"recent/stale/healthy/unhealthy/unmaintained" threshold is encoded. Therefore this slice does not
create a combined interpretation that would require a new undisclosed rule.

The fact references every project declaration evidence record for that package plus the exact npm
Registry external evidence.

### Deterministic shared support

The package now shares deterministic dependency grouping/order/truncation helpers across npm rules
and the existing FR-011 vulnerability rule. The refactor does not change FR-011 IDs or product
behavior.

Duplicate declarations of the same package/specifier remain one finding basis while preserving all
underlying dependency facts. Package-level health signals remain one fact per package and preserve
all declaration evidence.

### Verification

Focused fixtures cover:

- exact Semantic Version parsing and prerelease precedence;
- major/minor/patch/prerelease outdated differences;
- equal/older `latest` versions;
- ranges/tags as insufficient exact-version evidence;
- missing declared/comparison registry records;
- duplicate dependency groups;
- explicit deprecation and non-deprecated exact versions;
- no invented unmaintained heuristic;
- neutral health-signal content;
- partial npm sources;
- missing normalized metadata;
- missing/mismatched bound sources;
- cross-source/missing external evidence;
- invalid registry comparison versions;
- analyzer-core integration with test-only priority and insufficient-evidence scores.

No live network access is used.


## FR-008 dependency overlap

`JS-OVERLAP-008@1` is a finding-stage heuristic. It consumes dependency inventory facts rather than
re-reading provider data or depending on sibling finding output.

The rule uses a versioned-in-code curated catalog of explicit package pairs/capabilities. Initial
cases cover Biome/ESLint, Biome/Prettier, Axios/Ky, Day.js/Moment, and Jest/Vitest.

A supported pair produces one deterministic finding with:

- both package identities;
- the specific overlapping capability;
- all dependency-inventory fact/evidence references;
- medium confidence with a rationale tied to the curated rule and manifest-only evidence;
- explanatory text about duplicated configuration/API/workflow surface;
- an explicit statement that the finding does not establish that either dependency is unnecessary.

Pairs that merely share a broad ecosystem category are ignored unless they are in the explicit
catalog. This is deliberately narrower than FR-009 source-usage analysis.

## FR-012 framework/tool facts

`JS-TOOL-012@1` is a fact-stage rule that operates directly on the normalized manifest. It does not
depend on `JS-DEP-005` output, preserving same-stage independence.

A curated exact-package catalog covers supported frameworks, build tools, test frameworks,
linters/formatters, TypeScript, selected state-management libraries, and selected observability
tools.

One fact is emitted per supported package/role. Duplicate declarations across dependency groups
share one fact but preserve all declaration evidence. Unknown packages are not classified by fuzzy
name/category inference.

## Static repository project snapshot

`JavaScriptProjectSnapshot` extends the normalized package manifest with optional
`JavaScriptStaticProjectFile[]`.

`createJavaScriptProjectSnapshot` is a pure normalizer for files that have already been acquired. It:

- performs no filesystem/network access;
- validates canonical relative POSIX paths;
- rejects absolute paths, backslashes, control characters, dot/dot-dot/empty segments, and duplicate
  paths;
- clones dependency declarations/file records;
- sorts files with code-unit ordering.

This establishes the rule input shape needed by FR-013 without implementing FR-003 repository
acquisition early.

## FR-013 static project configuration

`JS-CONFIG-013@1` is a repository-oriented fact rule.

Supported configuration paths are identified statically. `createProjectConfigurationEvidence`
creates path-only `ProjectEvidence`; source content is not copied into evidence/report output.

Declarative strict-JSON inspection currently supports:

- TypeScript `tsconfig.json` / simple `tsconfig.*.json`;
- legacy ESLint `.eslintrc.json`;
- Prettier `.prettierrc` / `.prettierrc.json`;
- Biome `biome.json` and strict-JSON-compatible `biome.jsonc`.

Only an allowlisted set of high-level fields is surfaced. Unsupported value shapes produce a
configuration limitation instead of coercion.

Known JS/TS config families are identified by filename for ESLint flat/legacy config, Jest, Next.js,
Prettier, Rollup, Tailwind, Vite, Vitest, and webpack. Supported JS/CJS/MJS/TS/CTS/MTS variants are
never imported or executed; a separate rule-level limitation explains that dynamic values were not
resolved.

Recognized config-family filenames with unsupported extensions/formats still become configuration
facts plus `unsupported_configuration` limitations instead of being silently ignored. JSONC/comments
that strict JSON cannot parse remain file detections with an `unsupported_configuration`
limitation. Static declarative content over 512 Ki characters remains detected with a
`resource_limit` limitation and is not parsed.

This slice intentionally does not acquire repository files. Milestone G will supply bounded static
files from an immutable GitHub commit into this already-defined snapshot/rule boundary.

## Verification

Synthetic fixtures cover:

- exact supported framework/tool package detection;
- unknown packages not being guessed;
- duplicate declaration evidence preservation;
- every initial curated overlap pair mechanism and deterministic ordering;
- no broad-category overlap inference;
- medium-confidence overlap rationale and non-redundancy wording;
- deterministic static file ordering/path validation;
- supported TypeScript/Prettier characteristics;
- executable-looking dynamic config proving no code evaluation path exists;
- JSONC/comment partial inspection;
- recognized config families with unsupported formats/extensions;
- malformed supported configuration shapes;
- static configuration content limits;
- unrelated source files being ignored;
- analyzer-core integration with test-only priority and insufficient-evidence scoring.

No live repository/network access is used.


## FR-009 static source usage and potentially unnecessary dependencies

Milestone H adds an explicit source-reference parser adapter and keeps parsing outside finding-rule
logic.

The adapter currently uses `@babel/parser` under ADR-0010. This supersedes the original
typescript-estree implementation choice because StackLens now compiles with TypeScript 7 while the
current typescript-estree release line still depends on the TypeScript 6 compiler API. Analyzer
rules consume only StackLens-owned normalized references.

Supported JS/TS/JSX/TSX syntax includes:

- ESM static imports;
- ESM re-exports with a static source;
- CommonJS `require("...")` with a static string;
- dynamic `import("...")` with a static string.

Bare package subpaths normalize to the declared package identity. Relative references, Node built-ins,
URL/protocol imports, and package-import-map references are not external dependency usage.

`JavaScriptProjectSnapshot` can preserve already-normalized package-script commands.
`createJavaScriptSourceUsageSnapshot` combines supported source references with a narrow,
deterministic catalog of configuration-file conventions, exact Prettier plugin strings, and supported
script executable conventions. It never runs scripts, imports configuration, resolves modules, or
performs network/filesystem I/O.

Source usage has an explicit coverage state:

- `complete` — bounded acquisition was complete and all supported source parsed without unsupported
  dynamic references;
- `partial` — acquisition was limited or parsing/dynamic-reference uncertainty exists;
- `unavailable` — repository source acquisition was not supplied.

`JS-USAGE-009@1` emits positive `dependency.usage.static` facts only for declared dependencies and
retains path/line project evidence without copying source text into the report. Partial/unavailable
coverage emits an insufficient-evidence limitation.

`JS-UNNECESSARY-009@1` runs after completed facts. It emits at most one heuristic finding per
declared package only when coverage is complete and no supported source/configuration/script usage
fact exists. Peer-only declarations are excluded. Development/peer-involved declarations use lower
confidence than ordinary runtime/optional declarations. The description explicitly states that
static non-observation is not proof that removal is safe.

Quick-manifest analysis remains source-insufficient and therefore cannot produce FR-009 non-use
findings.

### FR-009 verification

Focused fixtures cover ESM import/export, static CommonJS require, static dynamic import, scoped and
subpath package normalization, local/builtin/protocol exclusion, parse failure, non-static dynamic
references, deterministic configuration/script conventions, positive usage facts, a complete-coverage
potentially-unnecessary finding, peer-only exclusion, and suppression of absence-based findings when
coverage is partial.

No analyzed source or configuration is executed.
