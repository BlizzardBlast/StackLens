# @stacklens/api

Application-layer orchestration for the StackLens hosted API.

`apps/api` now owns the Fastify REST/OpenAPI transport for asynchronous public-repository analysis
and still owns the framework-independent quick-manifest application service. Long-running
repository-analysis composition remains shared through `@stacklens/analysis-orchestration`; the API
and Worker do not import each other.

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

A future quick-manifest Fastify route should map these errors to the REST/OpenAPI contract rather
than changing their analysis semantics.

## Dependency inversion

Quick manifest analysis receives its `AnalyzerDefinition` as a dependency.

Long-running public-repository analysis is composed in `@stacklens/analysis-orchestration`, which
binds the production rule set/prioritizer/recommendations/scorer while keeping their formulas in their
own packages.

This is deliberate:

- the API does not own production priority policy;
- the API does not own production scoring formulas;
- the Worker reuses repository orchestration without importing the API application;
- Fastify transport can map application errors/status without changing analyzer behavior;
- quick-manifest tests can still inject a minimal deterministic analyzer.

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



## Development runtime

The package has a runnable PostgreSQL/Graphile composition boundary.

From the repository root, start PostgreSQL and all application processes with:

```bash
pnpm dev:infra
pnpm dev
```

Or run only the API after PostgreSQL is available:

```bash
pnpm --filter @stacklens/api dev
```

The local defaults are `DATABASE_URL=postgresql://stacklens:stacklens@127.0.0.1:5432/stacklens`,
`STACKLENS_API_HOST=127.0.0.1`, and `STACKLENS_API_PORT=3000`. Production should provide an
explicit `DATABASE_URL`.

`src/runtime.ts` owns infrastructure composition only: PostgreSQL pool, StackLens migrations,
Graphile Worker queue utilities, the durable repository implementation, and Fastify construction.
`src/main.ts` owns process environment, listening, and graceful shutdown. Route/application policy
remains in the existing testable modules.

## Public repository analysis HTTP transport

`createStackLensApi` exposes the Milestone J3 Fastify boundary:

- `POST /v1/analyses/repository` accepts only a public GitHub repository URL, reuses the shared
  GitHub URL parser, canonicalizes supported clone/trailing-slash forms, creates a UUID analysis ID,
  persists/enqueues through `@stacklens/repository-jobs`, and returns `202` with the ID;
- `GET /v1/analyses/:analysisId` reads `@stacklens/persistence` and returns durable status,
  coarse progress, terminal failure, or the persisted `AnalysisReport`;
- `GET /openapi.json` publishes OpenAPI 3.1 generated from the same Zod schemas used by Fastify
  validation and serialization.

The Fastify layer does not query Graphile tables, import `apps/worker`, collect provider data, or
reconstruct analyzer policy. The background Worker remains the only process that invokes
`@stacklens/analysis-orchestration` for queued repository work.

`createStackLensApi` receives an `AnalysisRepository` and `RepositoryJobQueue` so hosted runtime
composition can use Drizzle/PostgreSQL and Graphile Worker adapters without making Fastify routes
infrastructure-specific.

See [Repository Analysis Orchestration](../../docs/implementation/repository-analysis.md),
[Persistent Repository Analysis Jobs](../../docs/implementation/repository-jobs.md), and
[Repository Analysis HTTP Transport](../../docs/implementation/repository-api.md).

**Repository transport traceability:** FR-003, FR-004, FR-017, FR-021, DATA-006, NFR-003, NFR-008,
NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.
