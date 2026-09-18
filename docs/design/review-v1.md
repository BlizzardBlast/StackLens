# StackLens Design v1 Review

> **Status:** Accepted review baseline  
> **Date:** 2026-09-18  
> **Reviewed artifact:** `design/prototype/`  
> **Requirements:** FR-001–FR-004, FR-015–FR-022, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-006–NFR-008

This review promotes the initial Product Design v0.1 proposal into **StackLens Design v1** after a structured usability, accessibility, semantic-token, and interaction pass.

## 1. Review method

The coded prototype was reviewed against:

- requirement traceability;
- keyboard/interaction semantics;
- report hierarchy;
- responsive behavior defined in the prototype CSS;
- semantic-token usage;
- contrast calculations for text/status colors;
- anchor/navigation integrity;
- JavaScript syntax and structural checks.

Figma is intentionally not part of the StackLens design workflow at this stage. The repository-native prototype and documentation are the review artifacts.

## 2. Findings and corrections

### DR-001 — Light-theme semantic status colors were too light

**Requirement:** NFR-006  
**Severity:** Must fix  
**Status:** Fixed

The initial light-theme orange/amber/green status colors did not achieve 4.5:1 contrast when used as small badge/status text.

The semantic colors were darkened for light mode while preserving brighter variants for dark mode.

### DR-002 — Dark heuristic color needed a lighter theme variant

**Requirement:** NFR-006  
**Severity:** Must fix  
**Status:** Fixed

The original heuristic purple had insufficient contrast on dark surfaces. A separate dark-theme heuristic token is now used.

### DR-003 — Primary-button foreground must be theme-aware

**Requirement:** NFR-006  
**Severity:** Must fix  
**Status:** Fixed

White text on the brighter dark-theme primary blue did not meet normal-text contrast. The design system now has `primaryForeground` semantics:

- light primary → white foreground;
- dark primary → dark foreground.

### DR-004 — Input-mode controls looked like tabs but were not tabs

**Requirements:** FR-001, FR-002, NFR-006  
**Severity:** Must fix  
**Status:** Fixed

The GitHub/package.json switch now uses:
- `role="tablist"`;
- `role="tab"`;
- `aria-selected`;
- `aria-controls`;
- associated tab panels;
- Left/Right arrow-key switching.

The package.json flow is now actually represented in the prototype.

### DR-005 — Input validation state was specified but not implemented

**Requirement:** FR-004  
**Severity:** Must fix  
**Status:** Fixed

The prototype now preserves user input and displays an inline `role="alert"` validation message for:
- malformed/unsupported GitHub URLs;
- invalid package.json JSON.

### DR-006 — Evidence drawer did not contain keyboard focus

**Requirements:** FR-017, NFR-006  
**Severity:** Must fix  
**Status:** Fixed

The previous off-canvas `aside` visually behaved like a modal but remained part of the page's tab order when closed and did not provide modal focus containment.

It is now a native modal `<dialog>` in the prototype. Production will use the selected Base UI/shadcn dialog/sheet primitive.

### DR-007 — Compact report navigation was visual-only

**Requirement:** NFR-007  
**Severity:** Must fix  
**Status:** Fixed

The compact category selector now navigates to the selected report section/summary target.

### DR-008 — Report rail contained broken anchors

**Requirement:** NFR-007  
**Severity:** Must fix  
**Status:** Fixed

All prototype report navigation anchors now resolve to existing targets.

### DR-009 — Limitations were visible too late in the report

**Requirements:** PRD-004, FR-021, SCORE-003  
**Severity:** Important  
**Status:** Fixed

The detailed Limitations section remains at the end of the report, but the report header area now includes an explicit summary banner whenever limitations materially affect the analysis.

This prevents a score from being read without awareness that evidence is incomplete.

### DR-010 — Interactive targets were undersized

**Requirement:** NFR-006  
**Severity:** Important  
**Status:** Fixed

Icon controls were increased to 40×40 px and primary/secondary actions now have a minimum 44 px height.

## 3. Contrast validation

Contrast ratios below were calculated using WCAG relative-luminance math.

### Light theme

| Semantic use | Foreground | Background | Ratio |
| --- | --- | --- | ---: |
| Main foreground | `#13161c` | `#f9fafc` | 17.35:1 |
| Muted text | `#646e7d` | `#f9fafc` | 4.94:1 |
| Primary/action text | `#2e5cd1` | `#f9fafc` | 5.64:1 |
| Critical | `#c82333` | `#f9fafc` | 5.37:1 |
| High | `#b8420b` | `#f9fafc` | 5.26:1 |
| Medium/warning | `#9a5a00` | `#f9fafc` | 5.24:1 |
| Recommendation/success | `#147a4a` | `#f9fafc` | 5.14:1 |
| Heuristic | `#6d4ed3` | `#f9fafc` | 5.46:1 |
| Primary button foreground | white | `#2e5cd1` | 5.89:1 |

### Dark theme

| Semantic use | Foreground | Background/surface | Ratio |
| --- | --- | --- | ---: |
| Main foreground | `#f8fafc` | `#090a0e` | 18.91:1 |
| Muted text | `#828c9c` | `#090a0e` | 5.82:1 |
| Primary/action text | `#5c91fa` | `#090a0e` | 6.49:1 |
| Critical | `#ef5a63` | `#13161c` | 5.45:1 |
| High | `#f47b3c` | `#13161c` | 6.68:1 |
| Medium/warning | `#eda635` | `#13161c` | 8.72:1 |
| Recommendation/success | `#38ba79` | `#13161c` | 7.30:1 |
| Heuristic | `#8b6bea` | `#13161c` | 4.65:1 |
| Primary button foreground | `#090a0e` | `#5c91fa` | 6.49:1 |

These checks validate intended small-text/status use against the principal surfaces. Production components must still receive automated accessibility tests because composition can change effective contrast.

## 4. Structural validation

The review also verified:

- token JSON parses successfully;
- prototype JavaScript parses successfully;
- no duplicate HTML IDs;
- no broken in-page anchor targets;
- package.json and GitHub input modes both exist;
- inline validation is represented;
- evidence detail uses modal semantics;
- compact navigation is wired;
- primary-button foreground comes from a semantic token;
- limitation summary is visible before the score/detail sections.

## 5. Decisions retained

No evidence justified changing these v0.1 decisions:

- developer-dense rather than oversized-dashboard layout;
- neutral-first visual language;
- light and dark designed together;
- StackLens-owned design tokens/domain components;
- shadcn/ui + Base UI for generic accessible primitives;
- score + evidence coverage shown together;
- facts, heuristics, and recommendations remain distinct;
- N/A remains visually and semantically distinct from 0.

## 6. Design v1 acceptance

**Design v1 is accepted as the production-implementation baseline.**

This means implementation may now begin for the design infrastructure and shared UI layer, but screen implementation must still:
- reference accepted requirements;
- consume semantic design tokens;
- use production accessible primitives rather than copying prototype interaction code;
- preserve the finding/evidence/scoring grammar;
- preserve the explicit limitation states.

The disposable prototype remains useful for reference but is not application source code.

## 7. Next implementation step

Translate the accepted design into:
1. `packages/design-tokens`;
2. `packages/ui`;
3. token build/generation;
4. initial accessible generic primitives;
5. StackLens domain component contracts;
6. component-level tests before assembling `apps/web`.
