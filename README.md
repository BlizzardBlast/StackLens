# StackLens

StackLens is a requirements-driven developer tool for understanding the health of a software stack.

The initial product focuses on JavaScript and TypeScript projects. A developer provides a `package.json` or public GitHub repository and receives a deterministic, evidence-backed report covering dependencies, vulnerabilities, tooling, configuration, migration opportunities, technical-debt priorities, and explainable stack-health scores.

## Current status

**Requirements, architecture, Design v1, production design infrastructure, Analysis Report Contract v1, and the deterministic analyzer core are implemented. Ecosystem rules and product screens are not yet implemented.**

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [documentation governance](docs/documentation-governance.md) for the required documentation/journey update rules (**GOV-007**).

## Architecture

The accepted system architecture is documented in **[docs/architecture.md](docs/architecture.md)**, with individual decisions recorded under **[docs/adr/](docs/adr/)**.

The initial architecture is a TypeScript modular monolith with a reusable deterministic analyzer core, React/Vite web client, Fastify API, PostgreSQL-backed worker flow, and explicit npm/OSV/GitHub evidence adapters. Architecture choices are subordinate to the requirements (**GOV-006**).

## Product design

The **StackLens Product Design v1** baseline is documented under **[docs/design/](docs/design/README.md)**.

The repository contains:

- product-design principles and requirement traceability;
- MVP information architecture and user flows;
- low-fidelity wireframes;
- the StackLens design-system specification;
- DTCG-style platform-neutral design tokens;
- an accepted Design v1 review and disposable coded prototype at `design/prototype/`;
- a chronological project journey in `docs/design/journey.md`.

StackLens owns its visual language and domain components. shadcn/ui + Base UI are selected only as the implementation foundation for generic accessible primitives; they do not define the product's visual identity (**ADR-0006**).

The production design layer now lives in **`packages/design-tokens`** and **`packages/ui`**. See [Design infrastructure implementation](docs/implementation/design-infrastructure.md) and **ADR-0007**.

## Analysis contracts

The shared runtime-validatable analysis model lives in **`packages/contracts`**. It defines evidence, facts, factual/heuristic findings, separate recommendations, limitations, partial failures, and explainable score states for all future consumers.

See [Analysis Contracts v1](docs/implementation/analysis-contracts.md) and **ADR-0008**.

## Analyzer core

The reusable deterministic execution layer lives in **`packages/analyzer-core`**. It provides staged fact → finding-candidate → priority → recommendation orchestration, rule/reference isolation, priority and scoring dependency inversion, and contract-validated report assembly without provider or UI coupling.

See [Analyzer Core](docs/implementation/analyzer-core.md) and **ADR-0009**.

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
