# StackLens Design Principles

## DP-001 — Evidence is visible, not hidden

**Requirements:** PRD-001, FR-015, FR-017, DATA-001–DATA-005

A user should be able to move from recommendation → reason → evidence → source/rule without leaving the conceptual context of the finding.

Implications:

- evidence access is part of every finding pattern;
- rule/source information is secondary but discoverable;
- recommendations do not visually masquerade as observed facts.

## DP-002 — Uncertainty has a first-class visual state

**Requirements:** PRD-003, PRD-004, FR-021, SCORE-003

StackLens must represent:

- confirmed fact;
- heuristic finding;
- recommendation;
- insufficient evidence;
- unavailable external source;
- unsupported analysis.

"N/A" is not equivalent to zero.

## DP-003 — Priority is clearer than volume

**Requirements:** FR-016

Large repositories may have many findings. The design should answer "What deserves attention first?" before presenting exhaustive detail.

Implications:

- urgent actions appear before full tables;
- filters default to useful prioritization;
- counts support navigation but do not become vanity metrics.

## DP-004 — Health scores are entry points, not verdicts

**Requirements:** FR-018–FR-020, SCORE-001–SCORE-004

Scores summarize evidence; they do not replace it.

Implications:

- score cards show evidence coverage;
- every score links to a contribution breakdown;
- missing evidence is visible;
- category scores can be N/A.

## DP-005 — Developer-dense, not dashboard-bloated

StackLens is a technical inspection tool. It should feel closer to a high-quality developer tool than an executive BI dashboard.

Implications:

- high information density where useful;
- strong typographic hierarchy;
- restrained decoration;
- code/package names use monospace selectively;
- tables and lists are preferred over oversized cards when comparing technical data.

## DP-006 — Calm diagnostic language

Avoid alarmist visual language. A vulnerability can be critical without the entire screen becoming red.

Color is reserved for meaning:

- danger/critical;
- warning;
- success;
- informational;
- neutral/unknown.

Severity must always have a text/icon cue in addition to color.

## DP-007 — Light and dark are equal themes

Both themes are designed from semantic tokens. Dark mode is not a simple color inversion.

Surfaces, borders, focus rings, code blocks, severity states, and data visualization must preserve hierarchy and contrast in both themes.

## DP-008 — Accessibility is structural

**Requirement:** NFR-006

Accessibility is not a QA phase.

Design requirements include:

- visible focus;
- semantic headings;
- keyboard-operable disclosure/navigation;
- non-color status indicators;
- sufficient target sizes;
- readable line lengths;
- motion reduction;
- no information communicated only through hover.

## DP-009 — Responsive means hierarchy adapts

**Requirement:** NFR-007

Desktop can use persistent report navigation and dense tables. Narrow screens should reorder content rather than simply shrink it.

Priority:

1. analysis state;
2. score/coverage;
3. urgent findings;
4. category navigation;
5. details.

## DP-010 — Product components encode domain meaning

Generic primitives come from shadcn/Base UI. StackLens owns the components that express product semantics.

Examples:

- `HealthScore`
- `ScoreCoverage`
- `FindingCard`
- `FindingTypeBadge`
- `SeverityBadge`
- `ConfidenceIndicator`
- `EvidencePanel`
- `RuleReference`
- `AnalysisLimitation`
- `DependencyHealthRow`
- `MigrationOpportunity`
