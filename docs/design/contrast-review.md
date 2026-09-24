# Rendered color contrast review

**Date:** 2026-09-24  
**Requirements:** NFR-006, NFR-007, NFR-008, GOV-002, GOV-007  
**Pull request:** [#37](https://github.com/BlizzardBlast/StackLens/pull/37)

## Method and correction

Review the final foreground against its composited background, including transparency, selected
surfaces, hover states, and animation overlays. WCAG 2.2 AA requires 4.5:1 for normal text, 3:1 for
large text, and 3:1 for essential control/state indicators against adjacent colors. Calculations
compare unrounded ratios against the thresholds; displayed measurements below are approximate.

The token palette passed, but the progress screen applied 80% opacity to secondary descriptions.
In light mode this produced `#6F818C` over white at **4.04:1**. Completed and waiting stages still
contain readable information, so the disabled-control exception does not apply. Removing the
opacity restores **6.41:1** without changing the palette or weakening the information hierarchy.

Outlined actions now use the input-border token so their bounds remain distinguishable in default
and hover states. Evidence disclosure retains its short slide but no longer fades its text.
Decorative dividers, badge outlines, and background washes need not meet the control-border ratio;
their readable text and labels carry the meaning. Disabled form controls are exempt; busy feedback
is separately readable outside those disabled controls.

## Browser coverage

Chromium with axe-core 4.13.0 checked text in both system themes on the actual Vite application:

- repository and quick-input pages, placeholders, validation errors, and both native input choices;
- the local-file selector, selected radio indicators, primary-button hover, and keyboard focus;
- synchronous busy feedback using a delayed synthetic response;
- a contract-valid synthetic report with all four priority labels, fact/heuristic labels, all three
  confidence levels, N/A scores, a recommendation, limitations, expanded dependency inventory, and
  opened evidence with its Close action hovered;
- repository failure and its recovery action, including hover and focus;
- repository progress at four positions in the pulse cycle, including its strongest background;
- evidence entrance at 0, 90, and 180 ms, with opacity staying at 1 and animation disabled under
  reduced motion;
- the upload view at 320 px in both themes, with no document overflow.

No text-contrast violations remained in the reviewed states. The report scan covered 139 text
nodes per theme; progress covered 37 per theme at each sampled frame. Axe marked standalone
checkmarks, dots, diamonds, and arrows for manual review. Their foreground/background pairs were
checked separately; those incomplete results are not counted as automated passes. Input/action
borders and focus indicators were also measured separately because axe's text rule does not verify
them. This is browser-emulation evidence, not a whole-product accessibility certification or a
live-provider acceptance test.

| Reviewed pair | Light | Dark | Minimum |
| --- | ---: | ---: | ---: |
| Completed/waiting progress descriptions | 6.41:1 | 7.52:1 | 4.5:1 |
| Active-stage copy at strongest pulse | 5.18:1 | 5.57:1 | 4.5:1 |
| Lowest text ratio in the synthetic report | 5.05:1 | 5.50:1 | 4.5:1 |
| Input placeholder | 5.91:1 | 9.10:1 | 4.5:1 |
| Recovery-action border against hover fill | 3.04:1 | 3.59:1 | 3:1 |
| Focus outline against card surface | 4.82:1 | 6.91:1 | 3:1 |

## Regression protection

The design-token suite now has ten tests. Additional cases cover selected controls, error tints,
the evidence-coverage bar, and layered progress backgrounds across the pulse's opacity range.
Existing tests retain coverage for semantic text, every domain color, tinted badges, limitations,
action hover, input/focus indicators, and the brand panel in both themes. These tests protect
palette combinations; repeat browser review when component composition or opacity changes.

`pnpm check` passed: build, shadcn configuration, typecheck, tests (including 21 web and ten token
tests), lint, and formatting. Five existing database-gated tests were skipped locally without
`TEST_DATABASE_URL`; CI supplies PostgreSQL. Existing informational shadcn setup notices remain.
No accepted product behavior, scoring policy, token value, font choice, or architecture decision
changes in this follow-up.

## Standards

- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [axe-core API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)
