# External Data Sources

> **Status:** Accepted implementation baseline
> **Date:** 2026-09-19
> **Requirements:** FR-006, FR-007, FR-010, FR-011, DATA-001, DATA-002, NFR-003, NFR-004, SEC-002, SEC-008, GOV-007
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

Requested package names are bounded to npm's documented 214-character maximum, and the encoded
registry endpoint must also fit the shared 1,000-character source/evidence reference contract before
any network request is made.

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
- invalid/overlong package names and overlong encoded registry references rejected before network
  access.

No live provider request is required for the PR quality gate.


## OSV.dev vulnerability data

The second provider adapter implements the OSV boundary accepted by ADR-0003.

Current official API behavior reviewed for this implementation:

- `POST https://api.osv.dev/v1/querybatch` accepts multiple package/version queries and guarantees
  response ordering that matches the input;
- batch results contain vulnerability IDs/modified timestamps and can paginate per query;
- `GET https://api.osv.dev/v1/vulns/{id}` returns full advisory records;
- current OSV schema records can include top-level/per-package severity, severity source,
  publication/withdrawal timestamps, aliases/related/upstream IDs, affected packages, and references.

References:

- https://google.github.io/osv.dev/post-v1-querybatch/
- https://google.github.io/osv.dev/get-v1-vulns/
- https://ossf.github.io/osv-schema/

### Exact npm version boundary

OSV matching is version-sensitive. The adapter therefore accepts only exact npm semantic versions.

Accepted examples include:

- `1.2.3`;
- `1.2.3-beta.1`;
- `1.2.3-beta.1+build.5`.

Rejected before network access include ranges/tags such as:

- `^1.2.3`;
- `~1.2.3`;
- `>=1.2.3`;
- `1.2`;
- `latest`;
- `v1.2.3`.

This preserves ADR-0003's rule that a manifest range is not silently reinterpreted as an installed
version.

### Query normalization and pagination

Equivalent package/version queries are deduplicated and sorted before acquisition.

Each normalized result records:

- package name;
- exact queried version;
- matched advisory IDs plus OSV's match `modified` timestamp;
- `complete: true|false`.

OSV pagination is followed per query. Repeated page tokens or the configured pagination-round safety
bound mark only the affected query incomplete and convert the source to `partial`.

Known matches already returned by OSV are retained.

### Advisory details

Unique matched advisory IDs are resolved through OSV's fixed detail endpoint.

Normalized advisory metadata includes:

- advisory ID and schema version when supplied;
- summary;
- modified/published/withdrawn timestamps;
- aliases, related IDs, and upstream IDs;
- top-level severity records;
- affected package identity, explicit affected versions, and per-package severity records;
- validated HTTP(S) references.

Severity is preserved exactly as source metadata. This adapter does not derive a qualitative severity
label or scoring effect.

### Provenance and safe evidence links

The OSV source uses the fixed query-batch endpoint as its source reference.

Every matched advisory gets `ExternalEvidence` whose URL is generated from:

```text
https://osv.dev/vulnerability/<validated-advisory-id>
```

Provider-returned reference URLs are validated as absolute HTTP(S) URLs and remain normalized
advisory metadata. They are not substituted for the known OSV evidence URL.

### Partial failure semantics

Initial query acquisition failure makes the OSV source unavailable.

After at least one valid batch page has been acquired, later failures preserve known data and produce
a partial source instead. Examples include:

- pagination request failure;
- repeated/exhausted pagination token;
- advisory-detail HTTP/network failure;
- malformed advisory-detail payload.

A failed advisory-detail lookup does **not** erase the authoritative exact-version batch match. The
match remains available with the known OSV evidence URL, while the unavailable detail is disclosed
through a source-scoped partial failure.

A complete empty match list means only "no matching known vulnerability was returned by OSV for this
exact package/version query." It must not be converted into a "secure" fact (**FR-011**, **PRD-004**,
**SCORE-003**).

### Resource limits

OSV defaults in this slice:

- maximum query entries: 100;
- request timeout: 8 seconds;
- maximum response body: 16 MiB;
- maximum pagination rounds: 20;
- maximum full advisory-detail lookups: 500.

All are adapter options so deployment boundaries can be tightened without changing rule semantics.

If the advisory-detail lookup bound is reached, all exact-version batch matches and their known OSV
evidence links remain available, but the source is marked partial and only the bounded subset receives
full normalized advisory details.

### OSV verification

Synthetic tests cover:

- deterministic query sorting/deduplication;
- exact npm-version acceptance/rejection;
- batch ordering and contract-valid provenance;
- advisory/severity/reference normalization;
- publication/withdrawal metadata;
- pagination accumulation;
- incomplete/repeated pagination handling;
- authoritative match retention when detail retrieval fails;
- unsafe advisory-reference rejection without unsafe evidence links;
- initial provider failure and malformed batch response behavior;
- query-count, response-size, and advisory-detail request safety bounds;
- explicit empty-match semantics.

No live OSV request is required for the PR quality gate.
