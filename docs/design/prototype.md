# StackLens Coded Prototype v1

## Purpose

The prototype at `design/prototype/` is a disposable design artifact and the accepted visual/interaction reference for Design v1.

It exists to validate design decisions before production UI scaffolding. It must not be imported into the production application.

## Included states

The prototype includes:
- analyzer input;
- repository analysis progress;
- completed report;
- overall/category health;
- evidence coverage;
- priority findings;
- finding classification and confidence;
- evidence detail;
- limitations;
- light/dark mode;
- compact responsive behavior.

## Requirement coverage

| Prototype area | Requirements |
| --- | --- |
| Analyzer input | FR-001–FR-004, FR-022 |
| Progress | NFR-003, NFR-008 |
| Score summary | FR-018–FR-020, SCORE-001–SCORE-004 |
| Finding cards | FR-015–FR-017, DATA-003–DATA-005 |
| Evidence panel | DATA-001–DATA-006 |
| Limitations | FR-021, PRD-004 |
| Responsive behavior | NFR-007 |
| Interaction/accessibility direction | NFR-006 |

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

## Production handoff

Once accepted:
1. create `packages/design-tokens`;
2. automate DTCG token transformation;
3. create `packages/ui`;
4. add shadcn/Base UI primitives only as needed;
5. implement StackLens domain components against shared contracts;
6. recreate the prototype in `apps/web` using production components;
7. verify requirement IDs in component/flow tests where applicable.
