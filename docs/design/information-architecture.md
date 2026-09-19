# StackLens MVP Information Architecture

## Primary navigation

MVP anonymous mode does not need a traditional SaaS sidebar.

Top-level product surfaces:

```text
Analyze
└─ New analysis

Analysis
├─ Overview
├─ Findings
├─ Dependencies
├─ Security
├─ Maintainability
├─ Testing
├─ Tooling
└─ Limitations
```

The category navigation exists inside an analysis report, not as global product navigation.

## Screen 1 — Analyzer

**Requirements:** FR-001–FR-004, FR-022

Content order:

1. StackLens identity + concise promise
2. Input-mode switch
   - GitHub repository
   - package.json
3. Input area
4. Privacy/static-analysis note
5. Analyze CTA
6. Validation/error state

The screen should state that repository code is statically inspected and not executed (**SEC-001**) without turning the primary flow into a security policy page.

## Screen 2 — Analysis progress

**Requirements:** NFR-003, NFR-008, FR-021

Content order:

1. analyzed target identity
2. current stage
3. stage timeline
4. concise explanation of what is happening
5. partial-failure/limitation message if one occurs
6. cancel/navigation behavior when supported

Stages mirror the accepted architecture:

- queued
- resolving repository
- collecting snapshot
- collecting metadata
- running rules
- scoring
- completed / completed with limitations / failed

## Screen 3 — Report overview

**Requirements:** FR-005–FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004

### A. Report header

Shows:

- repository/project identity;
- analyzed commit/reference or input fingerprint;
- analysis time;
- analyzer/rule/scoring version access;
- "completed with limitations" state if applicable.

### B. Health summary

Shows:

- overall score, if available;
- evidence coverage;
- category scores;
- explicit N/A categories.

No score should imply certainty when evidence coverage is incomplete.

### C. Attention queue

Top prioritized actions from **FR-016**.

Each action exposes:

- severity/priority;
- finding type;
- concise problem;
- affected package/tool;
- why it matters;
- evidence access.

### D. Stack summary

Compact inventory:

- package manager;
- framework;
- build tool;
- test tooling;
- lint/format;
- observability;
- dependency counts;
- supported configuration.

### E. Category sections

The report can be navigated by:

- Findings
- Dependencies
- Security
- Maintainability
- Testing
- Tooling

Each section uses the same finding/evidence grammar.

### F. Limitations

Limitations are not buried in a footer.

Examples:

- OSV lookup unavailable;
- no exact installed version evidence;
- dynamic config not inspected;
- source files skipped due to limits;
- category evidence insufficient.

## Finding information architecture

Every material finding follows:

```text
Finding
├─ classification
│  ├─ fact
│  ├─ heuristic
│  └─ recommendation
├─ priority/severity
├─ affected subject
├─ statement
├─ why it matters
├─ confidence (heuristics only)
├─ action (when applicable)
├─ evidence
│  ├─ observed project evidence
│  ├─ external evidence
│  └─ retrieved/evaluated timestamp
├─ rule
│  ├─ rule ID
│  └─ rule version
└─ limitations
```

## Score information architecture

```text
Health Score
├─ value or N/A
├─ evidence coverage
├─ scoring version
└─ contributions
   ├─ finding
   ├─ category
   ├─ delta/weight
   ├─ evidence
   └─ rule
```

This ensures the score remains an explainable summary rather than an opaque grade.
