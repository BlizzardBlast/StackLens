# @stacklens/scoring

Pure stack-health-v3 scoring behind analyzer-core AnalysisScorer. Risk bands and equal-weight
readiness checks are independent of priority. Overall is capped by Dependencies and Security.
Unknown required checks prevent a numeric score; not-applicable and zero remain distinct.

No provider, UI or transport logic belongs here. The legacy scorer is a regression reference only;
saved reports are never rescored. See [Scoring policy](../../docs/implementation/scoring.md) and ADR-0013.

Traceability: FR-018–FR-021, SCORE-001–SCORE-004, NFR-001, NFR-004.
