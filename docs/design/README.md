# StackLens Product Design

> **Design baseline:** v1  
> **Status:** Accepted baseline  
> **Date:** 2026-09-18  
> **Requirements source:** [../requirements.md](../requirements.md)

This directory records StackLens product-design artifacts. Design decisions are subordinate to the accepted product requirements and system architecture. The historical `journey.md` path is now the project-wide chronological journey, including design, architecture, tooling, and implementation steps.

## Design artifacts

1. [Journey log](journey.md) — project-wide chronological record of material changes, decisions, corrections, and verification.
2. [Design principles](principles.md) — UX and visual principles derived from product requirements.
3. [Information architecture](information-architecture.md) — MVP content hierarchy and report structure.
4. [User flows](user-flows.md) — primary tasks and state transitions.
5. [Low-fidelity wireframes](wireframes.md) — layout exploration before visual polish.
6. [Design system](design-system.md) — tokens, component model, shadcn/Base UI policy, accessibility, themes, and data-display rules.
7. [Prototype specification](prototype.md) — what the coded prototype represents and how to evaluate it.
8. [Design v1 review](review-v1.md) — validation findings, contrast checks, corrections, and acceptance.
9. [Production visual refinement](visual-refinement.md) — palette, free font pairing, layout, and motion rationale.

Supporting design artifacts:

- `/design/tokens/stacklens.tokens.json` — platform-neutral design-token source.
- `/design/tokens/tokens.css` — frozen original Design v1 prototype mapping; production uses the generated token package.
- `/design/prototype/` — disposable coded prototype. It is **not** production application code.
- [ADR-0006](../adr/0006-design-system-and-prototyping.md) — architectural decision for the design-system strategy.

## Requirement traceability

The MVP design primarily exists to satisfy:

- **FR-001–FR-004** — input and validation;
- **FR-005–FR-017** — analysis content and evidence;
- **FR-018–FR-020** — explainable health scoring;
- **FR-021** — material limitations;
- **FR-022** — anonymous usage;
- **DATA-001–DATA-006** — provenance, rule identity, confidence, and fact/recommendation separation;
- **SCORE-001–SCORE-004** — deterministic and explainable scoring;
- **NFR-006** — accessibility;
- **NFR-007** — responsive experience;
- **NFR-008** — visible analysis progress.

No design artifact overrides an accepted requirement.
