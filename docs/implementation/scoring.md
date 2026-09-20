# Scoring Policy v1

> **Status:** Accepted implementation baseline  
> **Date:** 2026-09-20  
> **Requirements:** FR-016, FR-018–FR-021, DATA-006, SCORE-001–SCORE-004, NFR-001–NFR-005, GOV-007  
> **Decision:** ADR-0011

## Package responsibility

`packages/scoring` owns concrete deterministic score policy.

It implements `AnalysisScorer` from `@stacklens/analyzer-core` and depends only on generic contracts plus finalized analyzer state. It does not know how JavaScript source is parsed, how npm/OSV/GitHub data is fetched, or how findings are rendered.

The package does not perform network I/O and does not execute analyzed project code.

## Scoring version

Production scorer:

- scorer: `stackHealthScorer`;
- scoring version: `stack-health-v1`;
- score-contribution rule: `SCORE-STACK-001@1`.

The scoring version is copied into `AnalysisReport.analyzer.scoringVersion`, so reports produced under materially different formulas can be distinguished.

## Coverage gate

A numeric category score is allowed only when:

1. an explicit fact with type `analysis.coverage.<category>` exists; and
2. no report limitation affects that category.

If either condition is false, the category returns:

```text
status = insufficient_evidence
value  = absent
```

The scorer never converts a missing coverage fact into zero points and never treats an unavailable provider as a clean result.

The ecosystem rule package is responsible for producing coverage facts/limitations because it understands what evidence is required for its analysis domain. The generic scorer only enforces the gate.

## Available categories in v1

Numeric policy exists for:

- Dependencies;
- Security.

The following accepted categories remain N/A in v1:

- Maintainability;
- Testing;
- Tooling.

Their findings remain visible and prioritized. They simply do not influence a numeric category/overall score until an accepted complete-coverage policy exists.

## Deductions

An available category starts at 100.

Each finalized finding in that category produces one deduction:

| Finding priority | Points |
| --- | ---: |
| Critical | 40 |
| High | 25 |
| Medium | 12 |
| Low | 5 |

The final value is clamped at zero.

Each `ScoreContribution` contains:

- deterministic contribution ID;
- category and deduction direction;
- point value;
- rationale describing the priority-to-points rule;
- `SCORE-STACK-001@1` ownership;
- triggering finding ID;
- triggering finding evidence IDs.

There are no hidden additions or LLM adjustments.

## Overall score

The v1 overall score requires both Dependencies and Security to be available.

When both exist:

```text
overall = (dependencies + security) / 2
```

The result is rounded to two decimal places.

Because only two of the five accepted category families are numeric in v1, overall `evidenceCoverage` is 40.

If either Dependencies or Security is N/A, the overall score is N/A and references the blocking category limitations.

## Meaning of a clean security category

A 100 Security score means:

- every supported dependency was represented by an exact semantic version;
- the bound OSV source was complete;
- every exact-version query completed;
- every query had explicit provenance evidence; and
- no score-impacting supported security finding was produced.

It does **not** mean that the project is generally secure. StackLens MVP currently covers known dependency advisories, not every security property. The report/requirements retain that distinction.

## Determinism

Equivalent normalized facts, findings, limitations, and scoring version produce equivalent scores and contribution IDs.

Changing priority deductions, supported category coverage, or the overall formula is a scoring-policy change and requires a new scoring version plus ADR/documentation/test review.

## Verification

Package tests cover:

- deterministic deductions;
- contribution ownership/evidence;
- N/A behavior for unsupported or incomplete categories;
- overall averaging only across the two explicitly supported v1 categories;
- no penalty from unavailable evidence;
- schema-valid score output.

The JavaScript policy integration fixture additionally proves the complete analyzer flow from facts through findings, priority, recommendations, scoring, and report validation.

**Traceability:** FR-016, FR-018, FR-019, FR-020, FR-021, DATA-006, SCORE-001, SCORE-002, SCORE-003, SCORE-004, NFR-001, NFR-004, NFR-005, GOV-007.
