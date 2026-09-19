# @stacklens/api

Application-layer orchestration for the StackLens hosted API.

The current implementation is intentionally framework-independent. The accepted architecture still
uses Fastify for the HTTP transport, but the first milestone establishes the authoritative
quick-manifest service before adding transport/framework concerns.

## Quick manifest analysis

`analyzeQuickManifest` accepts:

- pasted `package.json` content; or
- uploaded content whose filename is exactly `package.json`.

Both modes flow through the same validation and orchestration boundary.

The service:

1. validates the input mode and JSON;
2. delegates manifest-shape validation/normalization to `@stacklens/rules-javascript`;
3. creates a deterministic versioned content fingerprint;
4. creates FR-005 project evidence;
5. records material quick-analysis limitations;
6. invokes `@stacklens/analyzer-core`;
7. returns a contract-valid report or a stable validation error.

## Validation errors

User-input failures use transport-independent codes:

- `empty_manifest`;
- `invalid_json`;
- `invalid_manifest`;
- `unsupported_upload`.

A future Fastify route should map these errors to the REST/OpenAPI contract rather than changing
their analysis semantics.

## Dependency inversion

The service receives its `AnalyzerDefinition` as a dependency.

This is deliberate:

- the API does not own production priority policy;
- the API does not own production scoring formulas;
- analyzer/rule construction can evolve independently as provider and scoring packages are added;
- tests can supply a minimal deterministic analyzer without adding premature production policy.

## Retention and safety

Quick analysis has no authentication or persistence dependency.

The service does not store the raw manifest. The report contains only:

- the input fingerprint;
- normalized evidence/facts required by implemented analysis;
- limitations and analyzer metadata.

Unrelated manifest fields are not copied into the report.

No analyzed project code, scripts, builds, tests, hooks, or dependencies are executed.

The current fingerprint format is a deterministic versioned FNV-1a 64-bit content fingerprint with
the UTF-16 string length included. It is an input identity/reproducibility marker, not a security
digest.

**Traceability:** FR-001, FR-002, FR-004, FR-005, FR-021, FR-022, NFR-001, NFR-004, SEC-001,
SEC-002, SEC-003.
