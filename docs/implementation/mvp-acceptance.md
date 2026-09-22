# MVP Acceptance Hardening

> **Status:** Automated acceptance baseline implemented  
> **Date:** 2026-09-22  
> **Requirements:** FR-001, FR-002, FR-003, FR-004, FR-017, FR-021, FR-022, NFR-006, NFR-007, NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007

## Purpose

This milestone hardens the implemented MVP without introducing new product behavior. It converts
two previously implicit end-to-end assumptions into permanent automated smoke coverage while keeping
live provider/network behavior out of normal PR correctness.

The acceptance boundary is intentionally split:

```text
production React route composition
          +
composed Fastify/PostgreSQL/Graphile runtime
          ↓
remaining manual real-browser/provider acceptance
```

## Production-router acceptance

`apps/web/src/mvp-acceptance.test.tsx` renders the real production `router` under the same
TanStack Query provider model used by the application.

It verifies one continuous path:

```text
/
  -> package.json mode
  -> /quick
  -> paste manifest
  -> manifest-only report + explicit N/A semantics
  -> StackLens home
  -> repository mode
  -> submit public GitHub URL
  -> /analyses/:analysisId
  -> terminal repository report
```

The test spies on the exported web client singleton methods, which is the network boundary already
owned by each adapter. It does not replace routes or duplicate product components. This keeps the
smoke deterministic while verifying production route registration, navigation, forms, mutation/query
handoff, and shared report composition.

## Composed API runtime acceptance

`apps/api/test/runtime.test.ts` initializes the actual API runtime with PostgreSQL, StackLens
migrations, Graphile Worker utilities, Drizzle persistence, queue adapters, and Fastify routes.

It verifies:

- repository submission produces real durable queued state without starting a Worker or contacting
  providers;
- quick manifest analysis returns synchronously through the same composed Fastify runtime;
- the quick report carries manifest input plus explicit limitations;
- the quick analysis ID cannot be read from the durable repository-analysis endpoint, proving the
  accepted non-persistent execution model at runtime composition level.

## What this baseline does not claim

Normal PR acceptance deliberately does not depend on:

- live GitHub/npm/OSV availability;
- browser automation against a listening Vite process;
- a real Worker completing an external repository analysis;
- visual layout judgment at physical viewport sizes;
- manual keyboard/focus inspection.

Those checks remain part of the next manual release-readiness pass. Their absence is not converted
into a clean conclusion about deployment readiness.

## Permanent gate

The existing `pnpm check` quality workflow runs both acceptance tests through the normal workspace
test tasks in addition to build, shadcn validation, strict TypeScript, Oxlint, Oxfmt, and the
PostgreSQL-backed integration suite.

No new CI technology or parallel product implementation is introduced.

**Traceability:** FR-001, FR-002, FR-003, FR-004, FR-017, FR-021, FR-022, NFR-006, NFR-007,
NFR-008, NFR-009, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007.
