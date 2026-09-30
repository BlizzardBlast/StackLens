# @stacklens/analysis-orchestration

Transport-independent application orchestration for StackLens analysis.

The package currently owns:

- the repository and provider-free quick-manifest v5 analyzer composition roots (schema 2.0.0);
- public GitHub repository analysis orchestration;
- deterministic provider sequencing and metadata bounds;
- transport-independent repository progress events whose observers may be asynchronous and are awaited;
- conversion of provider successes/failures into analyzer inputs.
- workspace discovery, bounded local configuration acquisition and package-scoped normalization;
- npm-name / OSV exact-version request deduplication with retained declaration provenance.

It depends on provider/analyzer/rule/scoring abstractions but owns none of their internal policy.

It does not own:

- HTTP/Fastify routes;
- Graphile Worker job registration;
- PostgreSQL persistence;
- React UI behavior;
- provider HTTP implementation details;
- finding/priority/recommendation/scoring formulas.

Repository contents remain transient and are not copied into returned progress state or analysis reports.

See [Repository Analysis Orchestration](../../docs/implementation/repository-analysis.md).

**Traceability:** FR-003–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001,
NFR-003–NFR-005, NFR-008, NFR-009, SEC-001–SEC-003, SEC-007, SEC-008.
