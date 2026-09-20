# ADR-0011: Deterministic priority, recommendation, and scoring policy v1

- **Status:** Accepted
- **Date:** 2026-09-20
- **Requirements:** FR-014–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-006, GOV-007
- **Related:** ADR-0008, ADR-0009, ADR-0010

## Context

StackLens already separates facts, findings, priority, recommendations, and scoring in the analyzer pipeline. Milestone I needs concrete production policy without collapsing those responsibilities or turning missing evidence into a negative result.

The accepted requirements require deterministic migration opportunities, actionable evidence-backed recommendations, explainable priority, overall/category scores when sufficient evidence exists, and N/A states when evidence is insufficient.

A scoring implementation that simply starts every project at 100 without proving evidence coverage would violate SCORE-003. Likewise, assigning urgency inside individual finding rules would violate the staged analyzer boundary established by ADR-0009.

## Decision

### Migration opportunity rule

The first FR-014 migration rule is `JS-MIGRATION-014@1`.

It identifies a migration-review opportunity only when:

- the project declares an exact supported semantic version;
- source-bound npm Registry metadata is available;
- npm's normalized `latest` dist-tag resolves to a supported exact version record; and
- the current and target versions cross a semantic major-version boundary.

The finding identifies current/target state, explains the major-version reason, remains heuristic with medium confidence, and explicitly does not claim that migration is mandatory.

Minor, patch, and prerelease differences remain FR-006 outdated findings rather than separate migration findings.

### Priority policy

The production JavaScript/TypeScript prioritizer is `JS-PRIORITY-016@1`.

Initial deterministic mappings are:

| Finding basis | Priority |
| --- | --- |
| Known vulnerability (`JS-VULN-011`) | High |
| Explicit npm deprecation (`JS-NPM-007`) | High |
| Major-version migration (`JS-MIGRATION-014`) | Medium |
| Exact-version outdated dependency (`JS-NPM-006`) | Medium |
| Curated dependency overlap (`JS-OVERLAP-008`) | Medium |
| Potentially unnecessary dependency (`JS-UNNECESSARY-009`) | Low |
| Unmapped security finding | High |
| Other supported unmapped finding | Low |

Heuristic confidence can only reduce/cap urgency; uncertainty never increases priority. Each priority contains explicit factor/evidence references and rationale.

### Recommendation policy

`JS-RECOMMEND-015@1` consumes finalized findings after priority.

It provides bounded actionable recommendations for the currently supported vulnerability, deprecation, outdated, migration, overlap, and potentially-unnecessary finding families.

Recommendations:

- preserve factual vs heuristic basis;
- reuse the finding evidence rather than inventing new facts;
- carry heuristic confidence when applicable;
- describe a review/action step instead of claiming an automatic change is safe;
- do not execute, install, migrate, or modify analyzed projects.

### Scoring coverage facts

`JS-COVERAGE-018@1` establishes whether category scoring is supported by the current normalized evidence.

Dependency scoring coverage requires:

- supported dependency declarations and project evidence;
- complete bounded source/configuration/script usage coverage;
- usable complete npm Registry metadata for each package;
- a supported `latest` dist-tag plus matching version record; and
- no material dependency-category limitation.

Security scoring coverage requires:

- exact semantic-version declarations;
- one complete bound OSV source;
- complete exact-version OSV query results for every scored dependency; and
- source-bound query provenance evidence for every exact-version query.

OSV therefore emits one query-level `ExternalEvidence` record for every exact-version query, including complete zero-match results. A zero-match record means only that OSV returned zero matching known vulnerabilities for that exact query; it is never described as proof that a dependency or project is secure.

Maintainability, Testing, and Tooling are explicitly insufficient evidence in scoring v1. Existing findings in those categories remain visible but do not create numeric category deductions until accepted coverage policy exists.

### Score policy v1

The concrete scorer lives in `@stacklens/scoring` and implements analyzer-core's `AnalysisScorer` interface.

Scoring version: `stack-health-v1`.

Contribution rule: `SCORE-STACK-001@1`.

For an available category, the score begins at 100 and applies deterministic finding-priority deductions:

| Priority | Deduction |
| --- | ---: |
| Critical | 40 |
| High | 25 |
| Medium | 12 |
| Low | 5 |

The category score is clamped to 0–100.

A category is numeric only when an explicit `analysis.coverage.<category>` fact exists and no limitation affects that category. Otherwise it is `insufficient_evidence` and receives no deduction.

Scoring v1 supports numeric Dependencies and Security categories. Maintainability, Testing, and Tooling remain N/A.

The overall score is the arithmetic mean of Dependencies and Security only when both are available. Its `evidenceCoverage` is 40, representing two of the five accepted category families. If either supported category is unavailable, the overall score is also insufficient evidence.

Score contributions reference the triggering finding evidence and the versioned scoring rule.

## Consequences

### Positive

- finding detection, urgency, advice, and scoring remain separate responsibilities;
- migration findings do not imply automatic upgrades;
- heuristic uncertainty cannot increase urgency;
- every numeric deduction is deterministic and explainable;
- zero-match OSV observations have explicit positive provenance;
- missing/unsupported evidence yields N/A instead of a silent penalty;
- the score version makes future policy changes identifiable under SCORE-004.

### Negative

- scoring v1 intentionally leaves three accepted categories N/A;
- an overall score is unavailable when either dependency or security evidence is incomplete;
- the initial weights are conservative policy choices and changing them requires a new scoring version plus documentation/tests;
- a 100 Security score under this policy means no supported score deductions were found within complete OSV exact-version coverage; it is not a claim that the project is universally secure.

## Supersession and future changes

This ADR does not change the staged analyzer architecture from ADR-0009.

Future category coverage, score weights, or priority mappings must be introduced as explicit versioned policy changes. UI/API code must consume the report contracts and must not recalculate priority or scores independently.

**Traceability:** FR-014–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-006, GOV-007.
