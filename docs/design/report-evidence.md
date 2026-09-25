# Report evidence and scoring explanations

Date: 2026-09-25. Requirements: FR-017–FR-021, SCORE-001–SCORE-004, NFR-006–NFR-008,
GOV-002, GOV-007. Policy: ADR-0012.

The report distinguishes useful completed checks from evidence still missing. Score cards state
their limited scope: version health, known advisories, major-version migration readiness, static
test setup, and tooling reproducibility. A numeric score is never a claim that tests ran or that
the repository is universally secure or maintainable.

The summary shows how many category scores are available and the analyzer's observed source-file
counts. The serialized 0/100 eligibility field is not a measured evidence percentage, so the
report no longer renders it as a coverage bar. Overall v2 requires all five categories. A zero
score remains a valid numeric result and includes an explanation when deductions reach the floor.

Each card has a native details/summary disclosure with a visible keyboard focus indicator. Available
scores show their analyzer-owned contribution ledger. N/A scores link directly to their blocking
limitation groups. Older v1 reports explicitly identify the three unimplemented policies and retain
their original scores; a new analysis is needed to use v2.

Limitations appear ahead of findings. Notices with identical kind and message are grouped; their
category and rule references remain accessible. Groups distinguish related analysis areas from
scores actually blocked. A dynamic ESLint preset can therefore remain an honest limitation while
independent version checks are available. Transient provider issues suggest retrying after recovery;
unsupported formats describe the missing support without promising that a retry alone fixes it.

The view uses existing semantic surfaces, text, warning, and focus tokens in both themes. It adds
no score thresholds, new color meaning, or animation. Disclosures keep the initial view compact;
narrow layouts stack the same content and retain native keyboard semantics. No repository content
or configuration source is copied into report evidence.

Verification results and captures are recorded in the PR journey entry and
[implementation record](../implementation/evidence-improvements.md).
