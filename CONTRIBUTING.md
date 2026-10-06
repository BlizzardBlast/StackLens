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

## Compiled runtime verification

`pnpm check` runs `pnpm runtime:smoke` after the build. CI runs the same command as an explicit
`Compiled runtime smoke` step with its PostgreSQL 18 service and `TEST_DATABASE_URL`. The smoke
checks the native Vercel entrypoint before HTTP binding, then compiled API/Worker startup, durable
submission, status readback and shutdown. It registers only a synthetic Worker task and makes no
live provider requests. Set `TEST_DATABASE_URL` to an isolated test database for local verification;
without it, only the compiled rules import runs and database runtime coverage is skipped.

## Browser acceptance

`pnpm check` includes the built web application's Playwright acceptance suite. After installing
dependencies, install its official engines once with `pnpm exec playwright install chromium firefox webkit`.
Run `pnpm build` followed by `pnpm test:browser` for a focused pass. CI installs Linux engine
dependencies and runs Chromium, Firefox and WebKit at 1280px and 320px with synthetic API responses.
The suite covers current and historical report readers, progress reflow, evidence focus, native file
replacement, error correction, terminal polling and deep links (FR-002/003/004/017/021/022,
NFR-006/007/008). It creates no live repository jobs. Local runs use one browser worker; CI uses two.
`pnpm typecheck:browser` checks the suite and configuration under the shared strict compiler policy.
Browser traces and results stay in ignored `.cache/playwright/`. WebKit emulation does not establish
physical Safari/iOS or spoken screen-reader acceptance.

## Operational verification

After `pnpm build`, prepare the official PostgreSQL client once with `docker pull postgres:18-alpine`
before running database-backed operation tests. CI prepares it before the test step so image-pull
diagnostics cannot contaminate binary backup capture. `pnpm test:operations` checks private configuration diagnostics, authenticated
archive retention/tampering/deletion and,
with a loopback `TEST_DATABASE_URL`, connection saturation across independent pools. The database
test creates and removes a disposable non-superuser role; it requires local role-management rights.
`pnpm test` includes these checks, so CI's PostgreSQL service supplies the database coverage.

Live-provider soak, hosted connections, process freeze and recovery rehearsals are explicit operator
commands outside normal correctness tests. Follow the [runbook](docs/implementation/preview-operational-hardening.md)
for limits, private configuration, source identity and teardown. Local rehearsals use uniquely named
owned databases; archive restore leaves its new database quarantined for readback and operator cleanup.
Never commit an archive, key, private configuration, raw provider log or report body as evidence.

The [Worker capacity harness](docs/implementation/worker-capacity.md) extends the existing soak with
bounded burst/sustained schedules, synthetic streaming HTTP and phase/resource observations. Its
five normal checks use small synthetic fixtures and verify independent observation/cleanup failures.
The 256 MiB/0.25 CPU measurements are explicit operator runs, with archive/harness hashes and no
assumption that sampled capacity is an SLA.

The opt-in [Worker lifecycle rehearsal](docs/implementation/worker-lifecycle.md) runs the packaged
Linux Worker through the observed panel launch and a native launch. It verifies cleanup stages,
interrupted-job replay and retained-report hashes in owned local databases. It also records the
outer shell's SIGTERM limitation separately; offline alone is insufficient proof of cleanup.
Synthetic transport is mounted only into rehearsal containers, never a hosted deployment.

The separate `restore-neon` action requires an exact approved direct endpoint, verified TLS,
PostgreSQL 18 and a new UUID-owned database. It does not relax local rehearsal guards or start a
copied queue. Its normal tests exercise endpoint/expiry/privacy/output safety without contacting
Neon. Follow the [independent recovery runbook](docs/implementation/independent-preview-recovery.md)
for explicit hosting cutover, original-executor fencing and paired URL/CA rollback.

The [portable recovery workflow](docs/implementation/portable-preview-recovery.md) adds two fresh
GitHub jobs with synthetic data only. Capture confirms original child exit and deletes its owned
database before encrypted handoff. Recovery verifies canonical fingerprints, copied active/queued/
outbox replay, terminal expiry, historical hashes and a fresh HTTP submission, then removes its
owned target. Normal authentication tests are part of `pnpm test:operations`. The separate manual
preview workflow requires approved protected-environment secret custody and stopped, drained
original compute; its activation and live-data acceptance are not implied by fixture CI.

The separate [persistent staging helper](docs/implementation/persistent-preview-recovery.md) binds
the portable manifest to an owned restore and publishes an exclusive private connection file
outside Git only after fingerprint, strict-reader, expiry and drained-state checks. Eleven normal
checks include real local PostgreSQL staging and rollback of rejected copies; they never contact
Neon or start replacement compute. Operations test files run serially because restore cleanup
assertions observe the shared local database catalog; this also bounds simultaneous operator
test connection/client-container load. Persistent hosting and public cutover remain operator gates.

The restricted-login integration check uses an owned database and non-superuser role. It verifies
denied DDL/Graphile access, missing-schema failure, Worker-only durable delivery, sanitized 503 at
role saturation and recovery after release. It uses synthetic providers; no hosted login is created
by normal tests. See [ADR-0019](docs/adr/0019-restricted-request-bound-database-role.md) for deployment
order and the [activation runbook](docs/implementation/restricted-preview-api.md).

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
