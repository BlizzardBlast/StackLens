# External Data Sources

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-006, FR-007, FR-010, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-007
> **Decision:** ADR-0003

## Purpose

`packages/data-sources` is the explicit network/provider boundary that prepares normalized external
metadata before analyzer-core runs.

Rules stay synchronous and provider-free.

The package reuses `@stacklens/contracts` for:

- `DataSource`;
- `ExternalEvidence`;
- retrieval timestamps;
- typed `PartialFailure` records.

## Generic provider seam

The package exposes:

```ts
interface EvidenceProvider<TRequest, TData> {
  readonly id: string;
  fetch(request: TRequest): Promise<ProviderResult<TData>>;
}
```

Success contains normalized provider data plus source/evidence provenance. Failure contains an
unavailable source and typed partial failure.

This makes unavailable provider data structurally different from a successful "no findings"
observation.

## npm Registry

The initial adapter calls the official package metadata endpoint:

```text
GET https://registry.npmjs.org/:package
Accept: application/json
```

Official npm Registry documentation reviewed for this implementation:

- https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md
- https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md

The full metadata document is requested rather than the abbreviated install form because StackLens
needs publication-time and repository metadata in addition to versions/dist-tags/deprecation.

## Normalized npm metadata

The adapter exposes:

- exact package identity;
- sorted dist-tag → version mappings;
- sorted version records;
- per-version explicit deprecation message when non-empty;
- per-version publication timestamp when supplied by npm;
- registry created/modified timestamps when supplied;
- repository type/URL/directory metadata when supplied.

This PR deliberately does **not** decide:

- whether a dependency is outdated;
- which version difference matters;
- whether a package is unmaintained;
- finding priority;
- recommendations;
- score effects.

Those remain later deterministic rule/policy responsibilities.

## Untrusted provider data

All registry payloads are validated before normalization.

The adapter fails closed when:

- the response package name differs from the requested package;
- required `versions` or `dist-tags` shapes are invalid;
- `latest` is absent;
- a dist-tag references a version not present in the response;
- a version object does not match its version key;
- deprecation metadata has an unexpected type;
- supplied timestamps are not ISO timestamps;
- repository metadata has an unsupported shape.

Malformed provider data does not become a partial fact.

## Resource limits

Defaults:

- request timeout: 8 seconds;
- maximum response body: 16 MiB.

Both are adapter options so hosted deployments/tests can configure stricter values without changing
rule semantics.

Response bytes are counted while streaming. Content-Length is also rejected early when it already
exceeds the configured limit.

## Provenance and safe references

Every successful package observation creates:

- an available npm Registry `DataSource` with `retrievedAt`;
- one `ExternalEvidence` record tied to that source.

The source/evidence reference and evidence URL are generated from the fixed npm Registry origin.

A package's publisher-controlled `repository` field is retained only as normalized metadata. It is
not emitted as `ExternalEvidence.url` in this slice, preserving **SEC-008** until a later safe-link
normalizer explicitly validates it.

## Failure semantics

Failures are source-scoped and do not include raw response bodies.

Current stable failure codes include:

- `npm_invalid_package_name`;
- `npm_http_<status>`;
- `npm_request_timeout`;
- `npm_request_failed`;
- `npm_response_too_large`;
- `npm_invalid_json`;
- `npm_invalid_response`.

HTTP 408/425/429 and 5xx responses are retryable. Other HTTP statuses are non-retryable by default.

## Verification

Synthetic tests cover:

- successful scoped-package acquisition;
- minimal valid metadata without optional time/repository fields;
- empty deprecation messages normalizing as not deprecated;
- versions/dist-tags/deprecation/publication/repository normalization;
- source/evidence contract validation;
- deterministic normalization under different object insertion order;
- publisher-controlled repository URL isolation;
- package identity mismatch;
- malformed deprecation metadata;
- invalid dist-tag/version references;
- invalid provider JSON;
- request timeout behavior;
- 404 vs 429 retryability;
- network failure redaction;
- response-size limits;
- invalid package names rejected before network access.

No live provider request is required for the PR quality gate.
