# StackLens MVP User Flows

## Flow A — Public GitHub repository analysis

**Requirements:** FR-003, FR-004, FR-005–FR-021, NFR-008

```mermaid
flowchart TD
  A[Analyzer] --> B[Choose GitHub repository]
  B --> C[Enter public GitHub URL]
  C --> D{Valid and accessible?}
  D -- No --> E[Inline validation/error]
  E --> C
  D -- Yes --> F[Create repository analysis]
  F --> G[Analysis progress]
  G --> H{Terminal state}
  H -- Failed --> I[Failure with actionable explanation]
  H -- Completed with limitations --> J[Report + limitations banner]
  H -- Completed --> K[Report]
  J --> L[Inspect priority finding]
  K --> L
  L --> M[Open evidence]
  M --> N[Inspect source/rule]
```

### UX rules

- Preserve the repository URL after validation errors.
- Do not present fake percentage progress if the backend only knows stage progress.
- Progress language should describe the actual architecture stage.
- Partial provider failures should not look identical to total failure.

## Flow B — Pasted package.json

**Requirements:** FR-001, FR-004, FR-022

```mermaid
flowchart TD
  A[Analyzer] --> B[Choose package.json]
  B --> C[Paste JSON]
  C --> D{Valid package manifest?}
  D -- No --> E[Precise validation message]
  E --> C
  D -- Yes --> F[Run quick analysis]
  F --> G[Report]
  G --> H[Show quick-analysis limitations]
```

### UX rules

The report must not imply source-level certainty. For example:
- package-use heuristics requiring imports may be unavailable;
- vulnerability matching may be N/A when no exact installed version can be established.

## Flow C — Understand a recommendation

**Requirements:** PRD-001, FR-015, FR-017, DATA-001–DATA-006

```mermaid
flowchart LR
  A[Recommendation] --> B[Why]
  B --> C[Evidence]
  C --> D[Source]
  C --> E[Rule ID/version]
  A --> F[Suggested action]
  A --> G[Confidence if heuristic]
```

The user should never need to trust a recommendation solely because "StackLens says so."

## Flow D — Understand a health score

**Requirements:** FR-018–FR-020, SCORE-001–SCORE-004

```mermaid
flowchart TD
  A[Overall score] --> B[Category breakdown]
  B --> C[Select category]
  C --> D[Contribution ledger]
  D --> E[Finding]
  E --> F[Evidence]
  A --> G[Evidence coverage]
  G --> H[N/A / missing evidence explanation]
```

## Flow E — Narrow viewport

The same product order remains, but report navigation changes:

```text
Report header
Score summary
Attention queue
Category selector (horizontal/combobox)
Selected category content
Limitations
```

A desktop left rail must not be required to understand or operate the report.
