# Quick Manifest Analysis

> **Status:** Accepted implementation baseline + HTTP transport
> **Date:** 2026-09-22
> **Requirements:** FR-001, FR-002, FR-004, FR-005, FR-017, FR-021, FR-022, NFR-001, NFR-004, SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007
> **Architecture:** `apps/api -> packages/*`

## Purpose

This slice establishes the authoritative application/service boundary for synchronous quick
`package.json` analysis before Fastify transport, external metadata providers, or product screens
are implemented.

It implements the accepted architecture responsibility that fast manifest analysis runs in-process
at the API application boundary.

## Input modes

The service supports two transport-neutral input shapes:

- `paste` with JSON text;
- `upload` with filename + JSON text.

Uploaded quick-analysis content is accepted only when the filename is `package.json`.

Both modes then use exactly the same JSON parsing, manifest normalization, evidence construction,
and analyzer path.

## Validation

Validation happens before analyzer execution.

Stable error codes are:

- `empty_manifest`;
- `invalid_json`;
- `invalid_manifest`;
- `unsupported_upload`.

JSON syntax failures use a stable public message instead of exposing runtime-specific parser text.

Manifest-shape errors reuse `normalizePackageManifest`, preserving FR-004's no-silent-coercion
behavior.

## Fingerprint and retention

The boundary creates a versioned deterministic fingerprint from the exact submitted string.

The initial implementation uses:

```text
fnv1a64:<utf16-length-hex>:<64-bit-hash>
```

The fingerprint is for reproducible input identity, not cryptographic authentication.

Raw manifest text is not part of the returned `AnalysisReport` and the service has no persistence
dependency. Unsupported/unneeded manifest fields are discarded during normalization instead of
being copied forward.

## Analyzer orchestration

The service composes:

```text
paste/upload content
      ↓
authoritative validation
      ↓
normalizePackageManifest
      ↓
input fingerprint + project evidence
      ↓
quick-analysis limitations
      ↓
injected AnalyzerDefinition
      ↓
runAnalyzer
      ↓
AnalysisReport
```

The `AnalyzerDefinition` is injected.

The application therefore does not own:

- finding priority policy;
- production scoring formulas;
- provider/network collection.

This keeps the existing dependency-inversion boundaries intact.

## Current limitations

Until the next provider milestones are implemented, quick analysis explicitly records:

- source/configuration evidence is unavailable in manifest-only mode;
- external package/vulnerability metadata is unavailable in the current analysis snapshot.

Missing evidence is not converted into a positive/negative finding or a perfect score.

## HTTP transport

Milestone K2 exposes the existing application service through synchronous
`POST /v1/analyze/manifest`.

The transport remains thin:

- one strict Zod request union represents `paste` or `upload` input;
- uploaded semantics preserve the submitted filename and content, while the authoritative service
  still requires the filename to be exactly `package.json`;
- request content is bounded to 524,288 characters and unknown fields are rejected before analysis;
- application validation codes map directly to stable source-free `400` responses;
- successful requests return `200` with a contract-valid `AnalysisReport`;
- the same schemas publish the operation through the existing OpenAPI 3.1 document;
- the route calls `analyzeQuickManifest`; it does not duplicate normalization, fingerprinting,
  evidence, limitations, or analyzer execution;
- no persistence, Graphile Worker job, repository polling, provider I/O, authentication, or raw
  manifest retention is introduced.

The upload contract is JSON rather than multipart: the web client may read a selected
`package.json` file and send its filename plus text content. This keeps transport behavior bounded
and leaves file-selection UX in the browser milestone without creating a second server-side analysis
path.

A dedicated manifest-only analyzer composition runs dependency inventory and deliberately returns
insufficient-evidence scores for the quick snapshot. It does not reuse the repository analyzer's
provider/source-dependent rules or `stack-health-v1` numeric scoring.

## Verification

Focused service and Fastify injection tests cover:

- valid pasted JSON through service and HTTP (**FR-001**);
- valid uploaded `package.json` semantics through service and HTTP (**FR-002**);
- invalid JSON and malformed manifest values (**FR-004**);
- unsupported upload filename (**FR-002**, **FR-004**);
- no authentication/persistence dependency (**FR-022**, **SEC-003**);
- ignored manifest fields not retained in the report (**SEC-003**);
- stable fingerprints across equivalent paste/upload content;
- contract-valid analyzer output and explicit limitations (**FR-017**, **FR-021**);
- strict request validation and bounded content (**FR-004**, **SEC-002**);
- OpenAPI publication from the same route schemas (**GOV-006**);
- HTTP success does not require persistence/background jobs (**FR-022**, **SEC-003**).
