# StackLens

StackLens is a requirements-driven developer tool for understanding the health of a software stack.

The initial product focuses on JavaScript and TypeScript projects. A developer provides a `package.json` or public GitHub repository and receives a deterministic, evidence-backed report covering dependencies, vulnerabilities, tooling, configuration, migration opportunities, technical-debt priorities, and explainable stack-health scores.

## Current status

**Requirements and system architecture defined; implementation has not started.**

The canonical product and system requirements are in **[docs/requirements.md](docs/requirements.md)**.

Do not treat this README, an issue, implementation detail, or code behavior as a replacement for an accepted requirement.

## MVP

The MVP is defined by the accepted requirements in `docs/requirements.md`. At a high level, it must support:

- pasted or uploaded `package.json` analysis;
- public GitHub repository analysis;
- dependency inventory;
- outdated dependency detection;
- deprecated/unmaintained dependency detection;
- overlapping/redundant dependency detection;
- potentially unnecessary dependency detection when sufficient evidence exists;
- dependency health signals;
- known vulnerability detection;
- framework/tool detection;
- project configuration detection;
- migration opportunities;
- evidence-backed recommendations;
- prioritized technical-debt actions;
- explainable overall and category health scores;
- explicit limitations and uncertainty.

AI/LLMs are **not required for MVP analysis**. The core analyzer is deterministic/static and evidence-driven (**PRD-002**, **NFR-001**).

StackLens must not execute arbitrary analyzed repository code, package scripts, builds, tests, hooks, or dependency installation as part of MVP analysis (**SEC-001**).

## Long-term direction

StackLens is intended to evolve into whole-repository intelligence covering:

`dependencies → configuration → source → architecture → tests → CI/CD → security → performance → technical debt`

Future product surfaces include authenticated/private GitHub analysis, history and monitoring, migration automation, CLI, GitHub automation, and IDE integration. See **FR-100 through FR-118** for accepted future requirements.

The intended product model is an **open-source core with a hosted SaaS experience** (**PRD-006**).

## Requirements-driven development

Per **GOV-002**, every product issue, implementation task, pull request, and acceptance test must reference at least one applicable requirement ID.

If proposed behavior is not covered by an accepted requirement, update the requirement before or in the same pull request as the implementation (**GOV-003**).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Architecture

The accepted system architecture is documented in **[docs/architecture.md](docs/architecture.md)**, with individual decisions recorded under **[docs/adr/](docs/adr/)**.

The initial architecture is a TypeScript modular monolith with a reusable deterministic analyzer core, React/Vite web client, Fastify API, PostgreSQL-backed worker flow, and explicit npm/OSV/GitHub evidence adapters. Architecture choices are subordinate to the requirements (**GOV-006**).

## Product design

The **StackLens Product Design v0.1** baseline is documented under **[docs/design/](docs/design/README.md)**.

The repository contains:
- product-design principles and requirement traceability;
- MVP information architecture and user flows;
- low-fidelity wireframes;
- the StackLens design-system specification;
- DTCG-style platform-neutral design tokens;
- a disposable coded prototype at `design/prototype/`;
- a chronological design journey in `docs/design/journey.md`.

StackLens owns its visual language and domain components. shadcn/ui + Base UI are selected only as the implementation foundation for generic accessible primitives; they do not define the product's visual identity (**ADR-0006**).

## Requirement examples

- `FR-006` — outdated dependency detection
- `FR-011` — known vulnerability detection
- `FR-015` — evidence-backed recommendations
- `SCORE-001` — deterministic scoring
- `SEC-001` — never execute analyzed repository code
- `NFR-002` — rule-level testability
- `GOV-002` — trace every product change

## License

See [LICENSE](LICENSE).
