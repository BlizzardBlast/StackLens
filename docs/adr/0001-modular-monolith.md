# ADR-0001: Modular monolith with reusable analyzer core

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** PRD-002, PRD-006, PRD-007, FR-108, FR-109, FR-110, NFR-001, NFR-002, NFR-004, NFR-005, GOV-006

## Context

StackLens begins as a web product but its accepted direction includes a CLI, GitHub automation, IDE integration, additional ecosystems, and whole-repository analysis.

The deterministic analyzer must remain reusable and independently testable. Product logic duplicated across web, worker, CLI, or integrations would make findings inconsistent and violate the stable-contract and deterministic-analysis requirements.

At the same time, the MVP does not justify independently deployed microservices for every capability.

## Decision

Use a **TypeScript modular monolith** with:

- separate runtime apps for web, API, and worker;
- reusable workspace packages for analyzer logic, JS/TS rules, contracts, scoring, data-source adapters, and persistence;
- strict dependency direction preventing analyzer packages from depending on web/API/database framework code.

The analyzer core is a library boundary, not a network service.

## Consequences

### Positive

- one authoritative analysis implementation;
- fast local development;
- low deployment complexity;
- direct fixture testing of rules;
- future CLI/GitHub/IDE surfaces can reuse the same packages;
- modules can be extracted later if scaling measurements justify it.

### Negative

- package boundaries require discipline because a monorepo makes improper imports technically easy;
- worker and API deployments share release cadence initially;
- some future independent scaling boundaries may require extraction work.

## Guardrails

- analyzer packages must not import from `apps/*`;
- rules must not perform hidden I/O;
- network/persistence are accessed through explicit application/adaptor boundaries;
- architecture tests or workspace linting should enforce dependency direction once implementation begins.
