# StackLens coded prototype

## Purpose

The prototype at `design/prototype/` is a disposable design artifact. Design v1 established the prior accepted visual/interaction reference; the v2 candidate is review-only until a later acceptance decision.

It exists to validate design decisions before production UI scaffolding. It must not be imported into the production application.

## Included states

The prototype includes:

- analyzer input;
- repository analysis progress;
- completed report;
- overall/category health;
- score availability, including explicit N/A;
- priority findings;
- finding classification and confidence;
- evidence detail;
- limitations;
- light/dark mode;
- compact responsive behavior.

## Requirement coverage

| Prototype area                      | Requirements                       |
| ----------------------------------- | ---------------------------------- |
| Analyzer input                      | FR-001–FR-004, FR-022              |
| Progress                            | NFR-003, NFR-008                   |
| Score summary                       | FR-018–FR-020, SCORE-001–SCORE-004 |
| Finding cards                       | FR-015–FR-017, DATA-003–DATA-005   |
| Evidence panel                      | DATA-001–DATA-006                  |
| Limitations                         | FR-021, PRD-004                    |
| Responsive behavior                 | NFR-007                            |
| Interaction/accessibility direction | NFR-006                            |

## What the prototype does not decide

The prototype does not define:

- production component APIs;
- backend/API behavior;
- final scoring thresholds;
- final copy;
- final brand/logo;
- final package/framework icon assets;
- animation polish;
- authentication;
- post-MVP saved-project UX.

## Prototype v2 candidate — 2026-10-08

The prototype tested this direction before its production adoption. It does not itself change the
production UI or the canonical token source.

- It loads the generated semantic theme output, rather than the historical prototype-only palette map.
- The input flow is an evidence-first workspace: source choice, bounded static-inspection disclosure, then action.
- The deep-teal input-to-action panel uses the named brand-surface tokens. Its text and dividers preserve contrast without assigning status meaning to teal.
- On narrow screens, the form follows the title before the supporting input-to-action panel, so analysis can begin without scrolling past explanatory content.
- The report says how many category scores are available instead of implying execution or safety through a coverage percentage.
- Score explanation uses an in-flow native disclosure. Finding evidence opens in the relevant finding, returns focus to its trigger when closed, and avoids a modal detour.
- The report reduces elevated-card repetition: a structured score block, compact category strip, and finding rows carry the hierarchy.

The input-workspace portion of this candidate was adopted in `apps/web` on 2026-10-08. The
prototype remains disposable and does not define a production component API, scoring policy, or
token value. The canonical editable palette remains `design/tokens/stacklens.tokens.json`; run the
token build before opening the prototype in a clean checkout so
`packages/design-tokens/dist/theme.css` is available.

## Review checklist

Before converting this design to production components, evaluate:

- Does the first screen make the input choices obvious?
- Can a user immediately identify whether analysis completed normally or with limitations?
- Does the report answer "what should I care about first?" within a few seconds?
- Can every recommendation visibly lead to evidence?
- Is the difference between fact, heuristic, and recommendation obvious without relying only on color?
- Is N/A clearly different from 0?
- Does the score explanation feel transparent rather than gamified?
- Is the interface still usable on a narrow viewport?
- Are light and dark themes equally intentional?
- Is the report information-dense without becoming visually exhausting?

## Production handoff status

The design-token package, shared UI package, and production web implementation already exist.
The 2026-10-08 conversion adopts the reviewed input-workspace composition using a shared
presentation component, semantic tokens, and existing route links. Production flow tests verify
the labelled evidence summary, static-inspection disclosure, and current input mode. Future design
experiments remain prototype-first and must follow ADR-0006/ADR-0007 before affecting product UI.
