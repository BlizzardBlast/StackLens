# @stacklens/data-sources

Explicit external-provider adapters for StackLens analysis.

## Responsibility

This package owns network/provider acquisition and normalization that must happen before
`@stacklens/analyzer-core`.

The first implemented provider is the public npm Registry.

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

## Tests

Normal PR tests use synthetic provider responses only. They do not depend on live npm availability.

**Traceability:** FR-006, FR-007, FR-010, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008.
