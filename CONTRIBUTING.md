# Contributing to StackLens

StackLens is requirements-driven.

Before proposing or implementing product behavior, read [docs/requirements.md](docs/requirements.md).

## Traceability rule

Per **GOV-002**, every product issue, implementation task, pull request, and acceptance test must reference at least one applicable requirement ID.

Examples:

- `Implements FR-006, DATA-001, DATA-002`
- `Fixes behavior required by FR-004`
- `Verifies SCORE-003`
- `Architecture decision supporting NFR-004 and NFR-005`

A product change without an applicable accepted requirement must first add or amend the requirement according to **GOV-003** and **GOV-005**.

## Development workflow

1. Identify the requirement(s) that motivate the work.
2. Confirm the proposed behavior is covered by those requirements.
3. If behavior is missing or materially different, update `docs/requirements.md` first or in the same pull request.
4. Implement the smallest change that satisfies the requirement.
5. Add verification for the relevant acceptance criteria.
6. Reference requirement IDs in tests where practical.
7. Update every durable document made stale by the change.
8. Append the work as a chronological step in `docs/design/journey.md`.
9. Open a pull request using the repository template and list the requirement IDs it satisfies.

## Tests and analysis rules

Per **NFR-002** and **GOV-004**:

- analysis rules must be independently testable;
- rule tests should use fixtures with explicit expected findings;
- acceptance tests should identify the requirement IDs they verify;
- heuristic behavior must test both positive findings and cases where evidence is insufficient.

## Product behavior vs implementation choices

Requirements define **what** StackLens must do. Architecture and technology choices define **how** it does it.

Per **GOV-006**, architecture decisions must cite the requirements they support. Do not turn a preferred library, framework, vendor, or implementation technique into a product requirement unless the product actually depends on that constraint.

## Security baseline

Any analyzer implementation must preserve **SEC-001** and **SEC-002**: analyzed repositories are untrusted input, and StackLens must not execute arbitrary repository code, package scripts, builds, tests, hooks, or dependency installation as part of MVP analysis.

## Requirement changes

A requirement change should explain:

- which requirement IDs change;
- why the current requirement is insufficient;
- how observable product behavior changes;
- whether acceptance criteria change;
- whether existing implementations/tests become non-compliant.

Do not silently redefine a requirement through code.

## Documentation definition of done

Per **GOV-007**, documentation is part of the implementation.

Every pull request must:

- update `docs/design/journey.md`;
- update the requirements, architecture/ADR, design, implementation, contributor, agent, or README documentation that the change materially affects;
- leave unrelated documents alone;
- explain documentation impact in the pull-request template.

See [docs/documentation-governance.md](docs/documentation-governance.md) for the source-of-truth map and completion checklist.

A change is not complete while documentation that describes the changed area is knowingly stale.
