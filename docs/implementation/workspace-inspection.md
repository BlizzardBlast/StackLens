# Workspace inspection and scoring v3 implementation record

Requirements: FR-005–FR-009, FR-011–FR-014, FR-018–FR-023, DATA-001–DATA-006,
SCORE-001–SCORE-004, SEC-001, SEC-002, GOV-002–GOV-007. Decision: ADR-0013.

## Baseline and execution sequence

Baseline: `8fe68e0e065f08b0ffdf9aaf0e664b9b7103d2e2` on
`codex/design-palette-typography` (PR #37). Worktree was clean. Implementation uses
`codex/workspace-inspection-scoring` in the existing checkout. Baseline checks were not rerun
before implementation; each phase and the final quality gate record fresh verification below.

1. Requirements and strict v1/v2 report contracts.
2. Workspace acquisition, catalogs, lockfiles, ownership, provider deduplication.
3. JSONC and bounded static configuration resolution.
4. MDX, lexical module aliases, bounded script delegation.
5. Severity bands, readiness checks, recommendation and priority corrections.
6. Compatible React/Fastify presentation, integration verification and handover.

## Review protocol

Each phase uses a read-only diff review, with coverage marked reviewed/partial/not applicable/
blocked. Findings record ID, severity, location, evidence, impact, remediation, verification and
state. The requested iterative-self-review then has at most three remediation passes per phase.
P0/P1 findings require changes; incomplete review cannot approve. No phase claims whole-repository
correctness. Relevant documentation is reviewed with every phase.

## Phase records

Implementation and review results are appended here as each gate completes.

### Phase 1 — contracts and requirements

Scope: diff review of contracts, ADR/requirements and compatible reader type narrowing.
Coverage: schema/version separation, references, unknown evidence, legacy behavior and traceability
reviewed; writer activation and final UI deferred to phases 5/6. Review completeness: COMPLETE
for this phase. Initial decision: REQUEST_CHANGES.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P1-101 | P1 | InspectionCheckDetailsSchema / validateReport | Unknown checks could omit a limitation; duplicate check references could repeat displayed checks. | Require an unknown-check limitation and unique score check references; contract regressions. | resolved |

Iterative pass 1 applied the guards. Contract tests and type checks verify the scoped repair.
The initial full typecheck exposed reader narrowing errors; these were fixed without weakening
compiler settings. No v2 writer has been enabled in this phase. Final decision: APPROVE for scope.

### Phase 2 — workspace evidence

Scope: FR-005/FR-023 discovery, exclusion patterns, catalogs, npm ancestor lookup, pnpm importers,
internal/peer declarations, namespaced rule evidence and bounded GitHub selection. Review
completeness: COMPLETE for this phase. Production activation and provider-query integration
verification remain phase 5 integration work; the current default writer is still v1.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P2-101 | P1 | workspace.ts | An ambiguous internal target without useful lockfile evidence lacked a scoped explanation. Catalog-resolved workspace edges could enter external acquisition. | Emit workspace_dependency_unresolved and filter effective workspace specifiers. Duplicate-name and catalog fixtures. | resolved |
| CR-P2-102 | P2 | workspace-rules.ts | Child scope prefixing relocated a shared lockfile's fact path. | Preserve canonical shared lockfile locations; verify all fact-to-evidence links and distinct package IDs. | resolved |
| CR-P2-103 | P1 | workspace.ts | Source under a malformed member could be attributed to the root. | Assign ownership using selected manifest paths, including unavailable members. Malformed-manifest regression. | resolved |

Iterative remediation pass 1 resolved the ledger. Final review found no remaining in-scope issues.
Verification: 125 JavaScript-rule tests, 80 provider tests, full 21-task typecheck passed.
Acquisition truncation preserves discovered member paths and does not create negative evidence.
Documentation impact: this phase record; final architecture/agent guidance awaits activation.
Final decision: APPROVE for scope.

### Phase 3 — bounded configuration resolution

Scope: FR-013, FR-021, SEC-001/002; JSONC diagnostics, local TypeScript inheritance/references,
immutable configuration imports, aliases, ordered spreads, supported wrapper/merge semantics,
and acquisition through a trusted orchestration selector. Review completeness: COMPLETE.
Initial decision: REQUEST_CHANGES.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P3-101 | P1 | static-configuration-parser.ts | Imported object escapes and CommonJS mutations could retain stale literal conclusions. | Invalidate imported aliases, changed wrappers, repeated CommonJS exports and executable local closures. Adversarial fixtures. | resolved |
| CR-P3-102 | P1 | github/adapter.ts | Ordinary source reservations could consume capacity before referenced configuration. | Promote pending references and replace unprocessed source reservations within the same budget. Immutable-blob, traversal, symlink and vendor tests. | resolved |
| CR-P3-103 | P2 | configuration-acquisition.ts | An already-acquired helper preceding its parent could miss a second-level JSON import. | Bounded fixed-point discovery over acquired files. Ordering regression. | resolved |

Remediation pass 1 applied the above fixes. Pass 2 reviewed uncertainty propagation, JSONC parser
diagnostics, explicit fields after unknown spreads, Vite array/null semantics, source-content
handling and global resource budgets; no further actionable findings. Vite special merge fields
outside the supported subset remain explicitly unresolved. Plugin implementation and external
preset contents are never executed/downloaded.

Verification: 143 rule tests, 81 provider tests, 21-task typecheck and git diff --check passed.
Synthetic acceptance snippets cover KerjaLog React Hooks, Frey-ui Vite/Vitest merges and Rollup
helpers. Full pinned repository integration remains phase 6. Structured inspection details are
emitted only on the workspace/v2 path, preserving the legacy writer until activation.
Documentation impact: ADR-0013 and this implementation record. Final decision: APPROVE for scope.

### Phase 4 — MDX, lexical aliases and script graphs

Scope: FR-009/FR-013/FR-019/FR-020 and SEC-001/002. Reviewed executable MDX selection, lexical
bindings, workspace ownership, shell token boundaries, declared runners, selectors, Turbo member
delegation and expansion bounds. No repository input is executed. Review completeness: COMPLETE.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P4-101 | P1 | module-bindings.ts / source-parser.ts | Reassigned global require.resolve or createRequire aliases could produce unsupported positive usage. | Check lexical bindings, constant violations and global loader mutation/escape. Shadow/reassignment fixtures. | resolved |
| CR-P4-102 | P2 | mdx-source.ts | Comments and JSX spread attributes need different syntax treatment from ordinary expressions. | Skip empty expression ASTs and preserve JSX/spread expression syntax; MDX regressions. | resolved |
| CR-P4-103 | P1 | source-usage.ts | Whitespace token scanning could count a binary appearing only in quoted echo text. | Tokenize the bounded command grammar and inspect actual command positions. Quoted command fixture. | resolved |

Remediation pass 1 resolved the ledger. Final scoped review found no additional actionable issues.
Verification: 165 rule tests, full 21-task typecheck and git diff --check passed. MDX fences are
ignored, source locations retained, and sibling coverage stays isolated. Shared/ancestor reference
ownership is conservative; unknown shell expressions suppress absence-based conclusions.
Babel traversal stays behind the parser adapter and uses the existing Babel 7 major.
Readiness applicability/check serialization and production activation follow in phase 5.
Final decision: APPROVE for scope.

### Phase 5 — scoring and production checks

Scope: diff review against FR-007/FR-011/FR-018–FR-023 and SCORE-001–004. Reviewed
risk-band selection, readiness applicability, exact-version provider binding, alias groups,
CVSS base vectors, advice priority, Expo recommendations, workspace provider deduplication and
the overall ceiling. React presentation and persisted/API integration remain phase 6.
Initial decision: REQUEST_CHANGES; remediation uses the recorded branch baseline above.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P5-101 | P1 | analysis-report.ts / inspection.ts | Serialized counts could disagree with referenced checks; a confirmed security check could omit severity. | Validate counts, category ownership and required security severity. Contract regressions. | resolved |
| CR-P5-102 | P1 | script-graph.ts / workspace-inspection.ts | Forwarded arguments and test-selection flags could claim an unrelated file matched a runner. | Unsupported overrides remain unknown; inspect supported Vitest/Jest selection fields and inherited Vite settings. CLI/config fixtures. | resolved |
| CR-P5-103 | P1 | workspace-inspection.ts / workspace.ts | Advisory records and internal lockfile links needed exact identity checks. | Require affected npm identity and matching pnpm internal links; preserve unsupported resolution uncertainty. | resolved |
| CR-P5-104 | P2 | changed rule identities / test fixtures | Changed rule behavior retained historical versions; new fixtures omitted required evidence references. | Advance changed rule versions, align explicit regression expectations and fix fixture provenance. | resolved |

Remediation pass 1 applied the evidence guards and provider regressions. Pass 2 addresses focused
lint/type diagnostics without changing policy or disabling checks. Final gate results follow.

Final verification: 24 contract, 12 scoring, 182 JavaScript-rule and 10 orchestration tests passed;
full 21-task typecheck passed, followed by a focused typecheck after the namespacing adapter cleanup.
Lint and git diff --check passed. Lint still prints existing shadcn configuration notices about cn
and the UI alias; these are not new source diagnostics. One local assertion documents the generic
reference mapper boundary; analyzer-core still runtime-validates its outputs. Review completeness:
COMPLETE for phase 5; final decision APPROVE. Documentation impact: ADR-0013 and this ledger;
release documentation and historical report integration are phase 6 work.

### Phase 6 — report presentation and release integration

Scope: diff review against FR-009/FR-013/FR-018–FR-023, DATA-006, SCORE-003/004,
SEC-001/002 and NFR-006–008. Baseline remains `8fe68e0`; all implementation files are
uncommitted on `codex/workspace-inspection-scoring`. No unrelated dirty files were found.
Read-only review identified the following ledger before remediation. Initial decision:
REQUEST_CHANGES. Final completeness depends on the remaining browser and full quality gates.

| ID | Severity | Location | Evidence / impact | Remediation / verification | State |
| --- | --- | --- | --- | --- | --- |
| CR-P6-101 | P1 | workspace-inspection.ts | Explicit Playwright includes reset testDir filtering; runner-independent config selection and ignored inline Jest settings can overstate matching files. | Select runner-specific settings, intersect file scope, retain uncertainty for opaque selection. Focused regression fixtures. | resolved |
| CR-P6-102 | P1 | source-usage.ts | Unrecognized static command names leave absence coverage complete even though their package identity is unknown. | Keep positive evidence but make unsupported executable conventions partial. Custom binary regression. | resolved |
| CR-P6-103 | P2 | workspace-rules.ts / project-readiness.ts | Structured limitation paths remain member-relative; adapted setup findings retain their old rule version. | Map paths with other package locations and advance setup identity. Contract/rule integration tests. | resolved |
| CR-P6-104 | P1 | workspace-inspection.ts | An unrelated noCheck config can fail a type-check safeguard without establishing the command's target. | Preserve target ambiguity as unknown instead of a confirmed failure; regression fixture. | resolved |
| CR-P6-105 | P2 | release documentation / quick-manifest-analysis.ts | Current guidance and a quick-mode category annotation still describe v2 migration scoring. | Update architecture, implementation, design, README, AGENTS and handover; documentation impact pass. | resolved |

Coverage so far: React state/filter derivation, supplied score decisions, shared Fastify schemas,
v1/v2 HTTP and database round trips, pinned fixtures, source privacy and bounded execution are
reviewed. Browser keyboard/theme/narrow-layout verification and final full-suite results follow.
The prior full check failed only formatting; focused database tests passed against the isolated
`stacklens_workspace_v3_test` database. Existing shadcn notices and the Vite bundle-size advisory
are recorded separately from source diagnostics.

### Phase 6 remediation and review outcome

Pass 1 resolved CR-P6-101–105: runner-specific/inline Jest settings, Playwright directory
intersection, conservative noCheck target ambiguity, partial coverage for unknown binaries,
canonical limitation paths, setup-rule version 2 and current release documentation. Pass 2 added
wrapped custom-command and canonical-path regressions and completed the documentation impact pass.
Focused verification: 24 contract, 188 JavaScript-rule and 12 orchestration tests; all passed.

| Concern | Status | Inspected paths / evidence | Limitation |
| --- | --- | --- | --- |
| React rendering, filters, links, keyboard | reviewed | analysis-report-view, inspection-details, 25 web tests; browser keyboard links/filter | Synthetic report, emulated browser |
| Fastify/shared contracts and persistence | reviewed | schema union, quick composition, inject tests, PostgreSQL round trips | Local database; no deployment claim |
| Workspace/config/source/scoring integration | reviewed | pinned fixtures, scoped phase 2–5 reviews, final selection/ownership regressions | Recorded subset plus synthetic providers/test files |
| Static execution/privacy/resource boundaries | reviewed | immutable acquisition/parser graph limits and adversarial fixtures | No runtime/reachability/transitive audit |
| Documentation and rollout compatibility | reviewed | requirements, ADR-0013, architecture, implementation, AGENTS, READMEs, design and handover | Compatible-reader-first rollout remains operational responsibility |

Browser verification used the actual report component with a contract-valid fixture. Light/dark
layouts at 320 and 1440 CSS px had no horizontal document overflow (305/1425 px content widths).
Keyboard disclosures, package filtering, fact/evidence target focus and automatic disclosure
opening passed. Reduced-motion buttons had zero transition duration. One main landmark and no
console warnings/errors were observed. Captures are stacklens-report-v3-light.png and dark.png.
Temporary preview markup was removed; viewport/media overrides were reset. Existing semantic
contrast token tests pass; this phase did not repeat the prior axe audit or claim physical-device
coverage. No new font download is required.

The first cold parallel database run exceeded the existing 10-second migration hook timeout.
The isolated persistence rerun passed all nine tests, and the subsequent complete pnpm check
passed including persistence/API database tests without changing timeouts. Existing shadcn alias/cn
notices, Graphile Windows executable-detection notice and a 509 kB Vite chunk advisory remain;
none were suppressed. A final check after the last regression additions is recorded below.

Review completeness: COMPLETE for the phase diff and the requested integration scope.
Final decision: APPROVE; iterative status: RESOLVED. No open in-scope ledger items. This is not a
claim that arbitrary repository syntax or runtime application behavior has been verified.

Final release verification (2026-09-27): pnpm check passed with TEST_DATABASE_URL targeting the
isolated database: build, shadcn project inspection, 21-task typecheck, 413 tests across the
workspace (including PostgreSQL and API runtime tests), lint and formatting. Turbo reused
unchanged successful tasks; changed suites ran freshly. git diff --check passed.

Delivery: [PR #38](https://github.com/BlizzardBlast/StackLens/pull/38) is stacked on PR #37's
`codex/design-palette-typography` branch. GitHub's quality workflow passed for implementation
commit `e91ed4c4d8eb54f72a848fc84cd0486aaca6e385`. The same PR includes the release handover.

## September 29 correction record

The subsequent [eight-finding remediation](review-findings-remediation.md) corrects npm internal-link
eligibility, Node discovery and migration aggregation. Current analyzer/rule-set identities are v5;
JS-INSPECTION-018 is version 2 and JS-MIGRATION-014 is version 3. Schema 2.0.0 and stack-health-v3
formulas are unchanged. The phase records above retain their original versions and verification.
