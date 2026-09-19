# Documentation Governance

> **Status:** Accepted project workflow  
> **Date:** 2026-09-19  
> **Requirement:** GOV-007

StackLens treats documentation as part of the implementation, not as optional follow-up work.

A pull request is incomplete when it changes a documented area but leaves the corresponding durable documentation stale.

## Source-of-truth map

| Change                                                        | Required durable documentation                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Product behavior, scope, acceptance criteria                  | `docs/requirements.md`                                                               |
| Architecture boundaries or technology decisions               | `docs/architecture.md` and the relevant ADR                                          |
| Product design, interaction patterns, accessibility semantics | relevant files under `docs/design/`                                                  |
| Design tokens or shared UI implementation                     | `docs/design/design-system.md` and/or `docs/implementation/design-infrastructure.md` |
| Tooling, workspace, CI, editor, package, or agent workflow    | relevant ADR/implementation document, `CONTRIBUTING.md`, and/or `AGENTS.md`          |
| Public project status or milestone                            | `README.md`                                                                          |
| Every pull request                                            | `docs/design/journey.md`                                                             |

Only update documents that are materially affected. Do not make unrelated documentation edits merely to create churn.

## Journey rule

The historical path remains `docs/design/journey.md`, but the file is the **project-wide chronological journey**.

Every pull request must append a concise entry that records:

1. what changed;
2. why it changed;
3. important alternatives, corrections, or trade-offs when relevant;
4. the requirement IDs or decision records that motivated the work; and
5. meaningful verification performed.

Do not rewrite old journey entries to make history look cleaner. Correct prior assumptions by appending a new entry.

## Definition of done

Before work is considered complete:

1. identify the applicable requirement IDs;
2. implement and test the change;
3. update every durable document made stale by the change;
4. append the journey entry;
5. run the applicable quality checks;
6. ensure the pull-request description reflects requirement and documentation impact.

Automated coding agents must perform the same documentation pass before reporting completion.

## Pull-request enforcement

The pull-request template requires requirement and documentation impact sections.

CI verifies that every pull request changes `docs/design/journey.md`. This is intentionally strict so implementation history cannot drift away from the repository's documented reasoning.

**Traceability:** GOV-002, GOV-003, GOV-005, GOV-006, GOV-007.
