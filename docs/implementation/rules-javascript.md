# JavaScript Rules

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-004, FR-005, FR-011, FR-017, DATA-001, DATA-002, DATA-003, DATA-005, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SEC-001, SEC-002, GOV-007
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
contains:

- exact package/version query results;
- advisory IDs returned for each query;
- whether each query result is complete;
- optional normalized advisory detail required for withdrawal/severity interpretation.

The shape is deliberately narrower than the provider DTO but structurally compatible with the
normalized OSV adapter snapshot. Acquisition remains responsible for validating provider data and
for report-level `DataSource`, `ExternalEvidence`, and `PartialFailure` records.

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
- references project dependency evidence and OSV external evidence;
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
- batch match without usable OSV `ExternalEvidence` → no finding is emitted because provenance
  would be incomplete;
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
- unrelated provider query results;
- analyzer-core contract integration.

No live network access is used.
