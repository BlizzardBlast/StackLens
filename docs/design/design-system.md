# StackLens Design System v1

## 1. Strategy

StackLens owns the design system. shadcn/ui is an implementation source, not the visual identity.

Layers:

```text
Product principles
      ↓
Design tokens
      ↓
Generic primitives
(shadcn/ui + Base UI)
      ↓
StackLens UI components
      ↓
Product patterns
      ↓
Screens
```

This design-system strategy is recorded in [ADR-0006](../adr/0006-design-system-and-prototyping.md).

## 2. Why shadcn/ui

Use shadcn/ui for source-owned generic components such as:

- Button
- Input
- Textarea
- Dialog
- Drawer
- Tooltip
- Popover
- Dropdown Menu
- Select
- Combobox
- Tabs
- Accordion
- Checkbox
- Radio Group
- Switch
- Table primitives where appropriate

New shadcn projects currently default to Base UI; shadcn continues to support Radix. StackLens should prefer the Base UI flavor for new primitives unless a concrete component limitation requires otherwise.

Important: generated shadcn code becomes StackLens code. It may be restyled/refactored to satisfy StackLens tokens and component APIs.

## 3. What we build ourselves

Domain components encode product meaning and must be designed by StackLens:

- `HealthScore`
- `CategoryScore`
- `ScoreCoverage`
- `ScoreContributionLedger`
- `FindingCard`
- `FindingTypeBadge`
- `SeverityBadge`
- `ConfidenceIndicator`
- `EvidencePanel`
- `EvidenceSource`
- `RuleReference`
- `AnalysisProgress`
- `AnalysisLimitation`
- `DependencyHealthRow`
- `MigrationOpportunity`
- `StackSummary`

## 4. Token architecture

The canonical design-phase token source is:

`design/tokens/stacklens.tokens.json`

It follows the Design Tokens Community Group JSON model where practical.

Token levels:

### Foundation

Raw reusable values:

- neutral/accent/status palettes;
- font families;
- type sizes;
- space scale;
- radii;
- shadows;
- duration/easing.

### Semantic

UI intent:

- background;
- surface;
- surface-raised;
- foreground;
- muted foreground;
- border;
- focus;
- primary;
- success;
- warning;
- danger;
- info.

### Domain semantic

StackLens meaning:

- severity critical/high/medium/low;
- evidence fact/heuristic/recommendation;
- confidence high/medium/low;
- score excellent/good/watch/poor/unknown.

Components should consume semantic/domain tokens, not raw palette tokens, except in deliberate token-definition work.

## 5. Color direction

The UI is neutral-first with a restrained cool accent. The September 2026 production refinement
uses steel `#F3F6F8`, paper `#FFFFFF`, ink `#172D38`, and action blue `#3156C8` as the core light
palette. Dark mode uses distinct blue-gray background, surface, and raised-surface values.

A dedicated brand surface (`#163744`) with pale cyan detail (`#8DD8E7`) explains the path from
evidence to action. Its foreground, muted text, accent, and border have named semantic tokens.
These brand colors communicate identity, not analysis success or a score. Status hues remain
red, orange, amber, green, and violet with independently tuned light/dark values.

Rules:

- background and surface hierarchy carries most visual structure;
- primary blue is used for interactive emphasis; brand tokens are reserved for the mark and
  evidence-explanation panels;
- red/orange/yellow are reserved for semantic status;
- successful/healthy state should not dominate the screen with green;
- unknown/N/A remains neutral;
- classification colors are subtle and must always have text labels/icons.

The v1 semantic token values are accepted as the implementation baseline. Brand-level refinement may still change values later, but semantic roles must remain stable unless this specification is revised.

## 6. Typography

Production pairing:

- UI, headings, and prose: IBM Plex Sans Variable, with system sans fallbacks;
- technical identifiers, paths, manifest input, and code: IBM Plex Mono, with system mono fallbacks.

Both are free OFL-1.1 fonts. The web application bundles them through Fontsource; no visitor font
request goes to Google Fonts or another font CDN. Use `font-display: swap`, and ship the license
notices with the application. The variable sans supports the existing weight hierarchy; mono loads
only normal Latin 400/500/600. Unsupported characters retain the declared system fallbacks.

The shared base stylesheet uses the generated `--sl-font-sans`/`--sl-font-mono` variables directly
so font inheritance does not depend on Tailwind emitting an otherwise unused utility variable.

Type roles:

- display — landing promise only;
- heading-1 — report/page title;
- heading-2 — major report sections;
- heading-3 — cards/panels;
- body;
- body-strong;
- label;
- caption;
- code/mono.

Dense technical tables use a slightly tighter body scale while preserving readability.

Input-page display text scales from 40 to 72 px, uses medium weight and a short line length, and
remains left aligned. Body copy stays 14–18 px; labels use sentence case. Technical mono is a role,
not a decorative treatment for every caption.

## 7. Spacing

Use a 4 px base rhythm with a practical semantic scale.

Preferred common values:

- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48
- 64

Avoid arbitrary values in product components unless a documented layout requirement needs one.

## 8. Radius

StackLens should not look overly soft.

Initial intent:

- controls: 8 px;
- standard surfaces/cards: 12 px;
- large feature surfaces: 16 px;
- pills/badges: full radius only when their semantic form is pill-like.

## 9. Elevation

Use border/surface contrast before shadow.

Elevation levels:

- 0 — flat;
- 1 — overlays/subtle raised panels;
- 2 — dialog/popover.

Avoid decorative large shadows in normal report cards.

## 10. Motion

Motion communicates state, not personality.

- fast feedback: 120 ms;
- normal transitions: 180 ms;
- complex panel transitions: 240 ms maximum by default;
- respect `prefers-reduced-motion`;
- analysis progress should not use fake indeterminate motion that suggests measurable progress.

Controls transition color/border/background feedback; newly opened evidence detail has one 180 ms
movement of 4 px with fully opaque text throughout. Reading content and decorative evidence diagrams
do not animate on load.
The shared stylesheet disables all animations/transitions under reduced motion while status text
remains available. Existing stage activity never changes into a percentage or score animation.

## 11. Dark mode

Light and dark are token modes, not separate component designs.

The production theme follows the system color preference. Explicit `.light` / `data-theme="light"`
and `.dark` / `data-theme="dark"` remain supported, without adding a stored theme preference or a
new settings flow. Brand explanation panels keep the same intentional dark surface in both modes.

Dark mode rules:

- avoid pure black large backgrounds;
- maintain surface separation;
- do not simply brighten all semantic colors;
- code and evidence panels require explicit dark-mode contrast review.

## 12. Finding grammar

### Finding classification

Use text + icon + semantic token:

- Fact
- Heuristic

Recommendations are separate domain entities, not a finding classification. Recommendation UI should use its own label/pattern rather than passing `"recommendation"` to `FindingCard` or `FindingTypeBadge`.

### Priority/severity

Use explicit labels:

- Critical
- High
- Medium
- Low

Do not use color-only dots.

### Confidence

Only show confidence when it has semantic meaning, primarily for heuristic findings:

- High confidence
- Medium confidence
- Low confidence

Confidence is not severity.

## 13. Health score grammar

Score ranges are presentation helpers, not requirements and must remain subordinate to scoring rules.

Initial visual states:

- excellent;
- good;
- watch;
- poor;
- unknown/N/A.

Do not hardcode product conclusions such as "healthy" solely from color. Score copy should remain descriptive and always expose evidence coverage.

## 14. Accessibility

**Requirement:** NFR-006

Baseline:

- target WCAG 2.2 AA;
- visible keyboard focus;
- headings follow logical order;
- controls have accessible names;
- overlays trap/restore focus appropriately through Base UI primitives;
- statuses include non-color cues;
- tables preserve header associations;
- charts must have textual equivalents;
- no critical evidence only on hover;
- minimum interactive target should generally be ~40–44 px where layout permits;
- reduced-motion mode.

Input pages share one `main` landmark and a visible-on-focus skip link. Selected input choices
have checkmarks as well as borders and native checked/current-page semantics. Focus indicators use
an opaque outline; hidden radio inputs expose a full-contrast ring on their visible label surface.
Token tests verify 4.5:1 text contrast (including tinted domain badges, limitation copy/icons, and
button hover states) and 3:1 input/focus contrast against light and dark surfaces. Selected/error
surfaces and the layered progress pulse are included. Readable secondary copy uses the opaque
muted-foreground token; do not dim it with additional opacity. Outlined actions use the input
border token, including their hover state. Decorative card dividers may retain the softer border
token because text and structure carry their meaning.

Token checks must be supplemented by rendered-state contrast review: CSS opacity and layered
backgrounds can invalidate a passing token pair. See the [contrast audit](contrast-review.md) for
the September 2026 light/dark browser measurements and coverage.

Base UI provides significant keyboard/ARIA/focus behavior, but StackLens remains responsible for correct composition, labels, copy, contrast, and semantics.

## 15. Responsive breakpoints

Do not design components around device names.

Suggested layout thresholds:

- compact: < 640 px;
- medium: 640–1023 px;
- wide: ≥ 1024 px.

Key behavioral changes:

- report rail becomes a compact category selector below wide layout;
- score cards wrap;
- tables may switch to stacked rows when horizontal comparison is not essential;
- evidence detail becomes full-height drawer/sheet on compact layouts.

## 16. Iconography

Use a consistent open-source icon set during implementation (candidate: Lucide, which aligns naturally with shadcn).

Rules:

- icons support labels rather than replacing unfamiliar concepts;
- severity/classification icons remain consistent;
- no decorative icon overload;
- package/framework logos are not required for MVP.

## 17. Component API philosophy

StackLens components should expose domain semantics:

Prefer:

```tsx
<FindingCard classification="heuristic" priority="medium" confidence="high" finding={finding} />
```

over:

```tsx
<Card className="border-yellow-..." />
```

The component maps domain semantics to tokens consistently.

## 18. shadcn customization policy

When adding a shadcn component:

1. add only when a product interaction needs it;
2. prefer Base UI for new components;
3. map colors/radius/typography to StackLens semantic tokens;
4. remove demo-only variants;
5. expose a small StackLens API rather than spreading generated internals everywhere;
6. add accessibility tests for meaningful custom composition;
7. do not modify an upstream-like primitive solely to create a one-off screen style—wrap it with a product component instead.

## 19. Token implementation path

The implementation path is now active:

`DTCG JSON → packages/design-tokens generator → generated semantic CSS/JS → packages/ui → apps/web`

`design/tokens/stacklens.tokens.json` remains canonical. Generated files under `packages/design-tokens/dist/` must not be hand-edited.

The generator also emits shadcn-compatible CSS variables and Tailwind CSS v4 `@theme inline` aliases so generic primitives and StackLens domain components consume the same semantic system.

See [Design infrastructure implementation](../implementation/design-infrastructure.md) and ADR-0007.

The production palette, font, and layout rationale is recorded in
[Visual refinement](visual-refinement.md). The original disposable prototype retains its historical
Design v1 palette; its hand-authored CSS is not a production token source.

## 20. External references

Reviewed 2026-09-18:

- shadcn/ui Base UI default: <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>
- shadcn/ui theming: <https://ui.shadcn.com/docs/theming>
- Base UI accessibility: <https://base-ui.com/react/overview/accessibility>
- Design Tokens Community Group: <https://www.designtokens.org/>
