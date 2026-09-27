# Report evidence and scoring explanations

Date: 2026-09-27. Requirements: FR-017–FR-021, SCORE-001–SCORE-004, NFR-006–NFR-008,
GOV-002, GOV-007. Policy: ADR-0013.

Each category shows its supplied scope, rationale and either a risk band or readiness checklist.
Risk counts describe affected package names and distinct advisories. Four textual check states
remain separate: Passed, Failed, Unknown, Not applicable. Numeric zero is a valid result;
insufficient evidence displays N/A; not applicable displays an em dash with its full label.
The overall rationale explains the risk ceiling. The UI never recalculates policy.

The summary shows available category scores and observed source-file counts separately from
check completeness. No percentage suggests the application was executed or shown to be secure.
Historical schema 1 reports retain their original scoring values and explanation model.

Native disclosures reveal checks, scoring decisions, supporting facts and evidence. Fragment links
connect decisions to facts, evidence and blocking limitation groups. Targets have visible focus.
Package controls filter findings and recommendations only; scores and limitations describe the
whole report. React derives filtered lists during rendering. Analyzer-supplied dispositions separate
confirmed issues, update opportunities and review advice. TanStack Query retains remote-state,
cancellation and terminal-polling ownership.

Limitations precede findings and group by structured reason and package scope, preserving every
message, affected file/check and score link. A known lint configuration can satisfy existence while
its external preset internals stay opaque. Unsupported selection settings still block checks that
need them. Provider failures remain visible and are never presented as clean results.

Both themes reuse semantic surface, text, warning and focus tokens plus the existing free,
self-hosted IBM Plex Sans/Mono pairing. This change needs no new motion or color meanings.
Controls wrap at narrow widths and preserve keyboard operation and reduced-motion preferences.
Source/configuration bodies never appear in stored evidence.

Verification results and captures are recorded in the PR journey entry and
[phase review](../implementation/workspace-inspection.md).
