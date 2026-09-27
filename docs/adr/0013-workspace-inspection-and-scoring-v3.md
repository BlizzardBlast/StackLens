# ADR-0013: Workspace inspection and risk/readiness scoring

- Status: Accepted
- Date: 2026-09-26
- Requirements: FR-005–FR-009, FR-011–FR-014, FR-018–FR-023, DATA-001–DATA-006,
  SCORE-001–SCORE-004, SEC-001, SEC-002, GOV-002, GOV-003, GOV-006, GOV-007
- Supersedes: the scoring policy and root-only inspection scope in ADR-0012

## Decision

Inspect declared pnpm/npm/Yarn workspace members, preserving declaration groups, original
specifiers, catalog intent, package ownership, and exact lockfile evidence. Internal links and
peer-only compatibility declarations are not npm installations. Deduplicate provider requests,
not declaration provenance. Repository source and configuration bodies remain transient.

Static inspection recognizes JSONC, MDX syntax, immutable local configuration references,
known configuration wrappers, and bounded script delegation. It never executes analyzed code,
plugins, package scripts, or dependency installation. External preset identities are supported;
their implementation is opaque. Unknown fields invalidate only conclusions that depend on them.

Report 2.0.0 carries structured checks, resolution and advisory details, scoped limitations,
and score explanations. Report 1.0.0 remains independently validated and readable. Historical
scores are never recomputed. Compatible readers precede new writers; rollback retains the reader.

`stack-health-v3` separates priority from scoring. Dependencies scores explicit npm deprecation
at the medium band. Security uses the worst validated active advisory severity. Bands are
none=100, low=90, medium=70, high=40, critical=0. Counts do not accumulate penalties. These
are ordinal product bands, not safety percentages. Updates, optional migrations, declaration
overlap and non-use heuristics have no numerical effect.

Maintainability checks lint and applicable type-check setup. Testing checks a supported execution
path and test-file presence. Tooling checks the shared package-manager pin and matching workspace
lockfile. Equal-weight applicable checks score `100 * passed / applicable`; any unknown required
check prevents a numeric score. Non-applicability is distinct from unknown and zero. Workspace
orchestration roots do not duplicate member readiness. Static setup does not prove execution,
test results, coverage, or code quality.

Overall is the mean of applicable categories capped by each applicable Dependencies/Security
score. Unknown required categories block overall. Empty applicability is not a numeric 100.
All arithmetic and scope eligibility live in scoring/rules, never React, Fastify, or the worker.

## Bounds and verification

Keep the 512-file, 520-request, 8 MiB acquisition budgets. Configuration graphs permit 16 levels
and 128 referenced files within those budgets; script graphs permit depth 16 and 256 nodes.
Truncation, unsupported syntax and malformed provider data remain explicit unknowns.

Use recorded/synthetic KerjaLog and Frey-ui fixtures plus adversarial cases. Each implementation
phase receives a diff review, bounded remediation (at most three passes), and focused checks.
Full repository verification and documentation accompany the release PR.
