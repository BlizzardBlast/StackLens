# @stacklens/data-sources

Explicit external-provider adapters for StackLens analysis.

## Responsibility

This package owns network/provider acquisition and normalization that must happen before
`@stacklens/analyzer-core`.

Implemented providers are the public npm Registry, OSV.dev, and public GitHub REST API.

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
- bounds full advisory-detail lookups while retaining all exact-version batch matches/evidence;
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


## Public GitHub repository adapter

`GitHubRepositoryAdapter` implements the public-repository acquisition boundary accepted by
ADR-0003.

Input is a supported repository URL:

```text
https://github.com/<owner>/<repository>
```

An optional ref may be supplied separately. Clone-style `.git` suffixes and a trailing slash are
normalized, but credentials, query parameters, fragments, non-HTTPS URLs, non-`github.com` hosts,
and extra path segments are rejected before network access.

Acquisition uses only the fixed `https://api.github.com/` origin:

1. retrieve public repository metadata and default branch;
2. resolve the requested/default ref to a commit;
3. record the immutable 40-character commit SHA;
4. request the commit's recursive Git tree;
5. fetch selected regular files by immutable Git blob SHA.

The adapter disables redirects. It does not call repository-supplied URLs.

### Initial file-selection policy

This milestone fetches only content required by rules that already exist:

- root `package.json`;
- root `package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock` for FR-023;
- TypeScript config names supported by FR-013;
- legacy/flat ESLint config names supported by FR-013;
- Prettier config names supported by FR-013;
- Biome config names supported by FR-013;
- supported Vite/Vitest/webpack/Rollup/Jest/Next.js/Tailwind config families.

General JS/TS source files are deliberately **not** fetched yet. FR-009 source-reference acquisition
belongs to the next milestone.

Recognized analysis files under generated/vendor directories such as `node_modules`, `dist`,
`build`, `coverage`, `.next`, and `.turbo` are skipped and disclosed.

Symlinks are not followed. Git submodules are not traversed. Git LFS pointers are not dereferenced.

### Resource bounds

Default GitHub acquisition bounds are:

- per-request timeout: 8 seconds;
- maximum JSON response body: 8 MiB;
- maximum retained selected files: 512;
- maximum decoded bytes per file: 512 KiB;
- maximum decoded bytes across retained files: 8 MiB;
- maximum requests per acquisition: 520;
- at most four in-flight blob reads, with byte/request reservations before dispatch and retention
  in candidate order. A rate-limit response prevents further batches.

`package.json` is prioritized first and supported root lockfiles immediately after it, ahead of
optional configuration/source candidates when file/request budgets are tight. Lockfiles are excluded
from source-usage coverage counts.

The GitHub recursive-tree API itself can report a truncated tree. StackLens preserves the returned
supported files but marks the source partial and records the truncation.

### Snapshot handoff

Successful data contains:

- contract-valid repository identity with immutable commit SHA/ref;
- optional root manifest content;
- selected static files as `{ path, content, blobSha, byteLength }`;
- source acquisition coverage (`complete` or `partial`) plus source candidate/acquired counts;
- acquisition limitations.

The selected file `path/content` shape is intentionally compatible with
`JavaScriptStaticProjectFile`. Application/worker orchestration can:

1. parse and normalize the transient root manifest with `@stacklens/rules-javascript`;
2. normalize any selected supported root lockfile into bounded resolved-dependency project evidence;
3. discard raw manifest/lockfile text after normalization;
4. pass selected config/source `path/content` fields into `createJavaScriptProjectSnapshot`;
5. map GitHub source coverage into the source-usage parser adapter;
6. run configuration/source rules without any further GitHub I/O.

This adapter does not parse project semantics and does not execute repository content.

### GitHub provenance and privacy

The source/evidence URL is generated only from the validated `github.com` repository identity and
resolved immutable commit.

Full selected file content exists only in the transient adapter result required to build the project
snapshot. It is not copied into `DataSource`, `ExternalEvidence`, limitations, or partial-failure
messages.

The adapter may receive an operator-supplied token for authenticated REST reads of public
repositories. That token only changes GitHub transport/rate-limit capacity: the repository parser
still rejects private repositories and the adapter performs no writes. User-connected GitHub
authentication, private repository access, and write access remain outside this milestone.

Rate-limit responses are classified without copying GitHub response bodies into StackLens failures.
A `429`, or a `403` carrying GitHub rate-limit headers such as
`x-ratelimit-remaining: 0` / `retry-after`, becomes a terminal `github_<operation>_rate_limited` failure with bounded manual retry guidance.
StackLens deliberately does not let Graphile auto-retry that request before GitHub's provider reset
window. Other `403` responses remain non-retryable forbidden provider failures.

## GitHub tests

Synthetic tests cover URL/ref validation, immutable commit resolution, fixed-host request behavior,
deterministic config/source selection, source-coverage classification, source/evidence contract validation, file/request/byte limits, tree
truncation, symlink/submodule/generated/vendor handling, binary/LFS handling, missing root manifests,
partial blob failures, malformed provider payloads, timeout/rate-limit/network behavior, response
limits, and source-content isolation from report provenance.

No live GitHub request is required for normal PR correctness.

**GitHub traceability:** FR-003, FR-004, FR-013, FR-017, FR-021, FR-023, DATA-001, DATA-002, DATA-006,
NFR-001, NFR-003, NFR-004, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, SEC-008.

## OSV query evidence

OSV acquisition now emits provenance evidence for each exact package/version query as well as
advisory evidence for matches. Query references use `npm:<package>@<version>`.

This allows downstream scoring coverage to distinguish "OSV queried this exact version and returned
zero supported matches" from "no OSV evidence was available." It must never be presented as proof
that the dependency/project is secure.

See [External Data Sources](../../docs/implementation/data-sources.md) and ADR-0011.
