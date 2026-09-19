# @stacklens/data-sources

Explicit external-provider adapters for StackLens analysis.

## Responsibility

This package owns network/provider acquisition and normalization that must happen before
`@stacklens/analyzer-core`.

Implemented providers are the public npm Registry and OSV.dev.

It does not own:

- JavaScript/TypeScript finding rules;
- priority policy;
- recommendations;
- scoring;
- persistence;
- API routes or UI behavior.

## Provider result boundary

`EvidenceProvider<TRequest, TData>` returns a typed `ProviderResult<TData>`.

A successful result contains:

- normalized StackLens-owned provider data;
- an available/partial `DataSource`;
- external evidence records;
- any typed partial failures.

A failed result contains:

- an unavailable `DataSource`;
- a typed source-scoped `PartialFailure`.

Provider failures are not represented as empty successful data.

## npm Registry adapter

`NpmRegistryAdapter` retrieves:

```text
GET https://registry.npmjs.org/<percent-encoded-package-name>
Accept: application/json
```

The full package metadata response is used because later rules need:

- all published version identifiers;
- dist-tags such as `latest`;
- explicit per-version `deprecated` messages;
- publication timestamps;
- repository metadata.

Normalized metadata is deterministic and independent of JSON object insertion order.

The adapter validates that the returned package name matches the requested package and that every
dist-tag references a returned version.

## Safety

Provider responses are untrusted.

The npm adapter therefore:

- uses a fixed provider origin rather than a user-controlled host;
- bounds request duration and response bytes;
- validates package identity, npm's package-name length bound, contract-safe generated references,
  and expected metadata shapes;
- does not copy raw response bodies into failures;
- does not expose low-level network error details;
- does not promote publisher-controlled repository URLs into external-evidence links.

The evidence URL is generated from the known npm Registry origin.

Repository metadata remains available to later rules/adapters, but it must be separately validated
before presentation as an external link.

## OSV vulnerability adapter

`OsvVulnerabilityAdapter` accepts npm package/version queries only when the version is exact semantic
version evidence. Ranges, tags, shortened versions, and `v`-prefixed versions are rejected before
network access so quick-analysis declarations such as `^1.2.3` are never silently treated as the
installed version.

Acquisition uses:

```text
POST https://api.osv.dev/v1/querybatch
GET  https://api.osv.dev/v1/vulns/<advisory-id>
```

The batch request establishes exact package/version → advisory matches. Because OSV's batch endpoint
returns compact match records rather than full advisory details, unique matched IDs are resolved
through the fixed OSV detail endpoint.

The adapter:

- deduplicates/sorts equivalent queries deterministically;
- follows per-query OSV pagination within an explicit safety bound;
- preserves whether each query result is complete;
- preserves advisory IDs, match modified timestamps, publication/withdrawal timestamps, aliases,
  related/upstream IDs, CVSS severity records (including source when supplied), affected package
  metadata, and validated HTTP(S) references;
- generates report evidence links only from the known `osv.dev/vulnerability/` origin;
- keeps authoritative batch matches when optional advisory-detail retrieval fails;
- returns a `partial` data source plus typed failures when pagination/detail acquisition is
  incomplete.

An empty **complete** OSV match set means only that OSV returned no matching known vulnerability for
the exact package/version evidence. It is not a statement that the dependency is secure.

## Tests

Normal PR tests use synthetic provider responses only. They do not depend on live npm availability.

**Traceability:** FR-006, FR-007, FR-010, FR-011, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008.
