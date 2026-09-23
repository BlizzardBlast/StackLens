# StackLens visual refinement

**Date:** 2026-09-23  
**Requirements:** PRD-004, FR-001–FR-003, FR-017, FR-021, FR-022, NFR-006–NFR-008, GOV-007

## Intent and audit

StackLens is a developer's inspection tool: evidence should feel legible, grounded, and calm.
The existing cool accent supports this intent. The production input pages nevertheless repeat
pale cards, rounded containers, uppercase labels, and background washes. System fonts provide
little continuity between explanatory prose and package identifiers. Some visible copy describes
internal transport and persistence details instead of helping someone choose an input.

Keep the diagnostic character, but distinguish the reading surface, action surface, and evidence
explanation. Do not introduce decorative severity colors, invented sample scores, or fake progress.

## Design plan and critique

The core palette is steel `#F3F6F8`, paper `#FFFFFF`, ink `#172D38`, action blue `#3156C8`,
deep teal `#163744`, and lens cyan `#8DD8E7`. Teal/cyan belong to a named brand panel, not a
health or success state. Existing fact/heuristic/recommendation and severity roles stay explicit.
All production values come from the canonical token source, including their dark-mode counterparts.

Use IBM Plex Sans for headings and prose and IBM Plex Mono for package names, paths, and code.
The coordinated family has enough shared structure for a technical tool, with a clear distinction
between prose and identifiers. Avoid using mono as decoration on every label. Both families are
OFL-1.1, bundled locally through Fontsource with system fallbacks and `font-display: swap`.

Keep input pages left aligned. Prefer this composition over a grid of interchangeable cards:

```text
StackLens mark and name                         Product purpose

Short, strong title                  Input-mode navigation
Plain-language explanation          Form title and instructions
                                    Labeled input and action
Evidence → findings → next steps     Help and request feedback

Three concise analysis principles with a shared divider
```

On compact screens the title precedes the form; supporting explanations follow the form so
starting an analysis does not require scrolling through marketing content. Quick analysis uses
the same form treatment and a plain ordered explanation of its narrower scope.

The initial idea of adding more tinted capability cards would repeat the existing monotony.
Instead, spend the visual emphasis on one dark evidence panel, simplify the headline and mode
selector, and vary hierarchy through typography and open spacing. Preserve dense, quiet reports.

Motion answers actions: 120–180 ms control feedback and a short evidence-disclosure entrance.
Do not animate the decorative evidence explanation or stagger page content. Reduced-motion mode
disables transitions and animation, including existing busy feedback, while retaining status text.

## Verification

`pnpm check` passed, including 21 web tests and six token tests. Five existing database-gated tests
were skipped locally because `TEST_DATABASE_URL` was not configured. The CI workflow supplies
PostgreSQL for those tests. Two existing shadcn plugin setup notices remain informational; lint exits
successfully with the repository's existing rule policy.

Chromium review covered both input routes at 320, 390, 768, 1024, and 1440 px in both themes:
no horizontal document overflow and exactly one main landmark in all 20 combinations. Keyboard
checks covered the skip link, native radio arrow-key selection, and visible focus. A synthetic upload
response exercised busy feedback, the manifest report, N/A scores, and focused evidence disclosure.
Synthetic repository responses exercised active stages and terminal failure on a compact viewport.

The evidence entrance computes to 180 ms normally and `animation: none` under reduced motion;
the existing progress pulse also becomes `none`. Fonts were observed loading from the local origin,
and both license notices were verified in the production build. System dark mode and an explicit
light override were checked. These are browser-emulation checks, not physical-device evidence or
live-provider acceptance.

Review captures:

- [Repository input, light, 1440 px](review-assets/stacklens-home-light.png)
- [Repository input, dark, 1440 px](review-assets/stacklens-home-dark.png)
- [Quick input, light, 390 px](review-assets/stacklens-quick-mobile-light.png)

## Sources

- [IBM Plex and its Open Font License](https://github.com/IBM/plex)
- [Fontsource Vite integration](https://fontsource.org/docs/guides/vite)

This refines Design v1 within ADR-0006/ADR-0007; analyzer behavior and accepted requirements do
not change. The disposable original prototype remains a historical Design v1 artifact.
