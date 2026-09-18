# StackLens Design Journey

This document is the chronological design log for StackLens. It records not only what was chosen, but the reasoning and requirement links behind each step.

## 2026-09-18 — Step 1: Requirements before interface

The project began by defining `docs/requirements.md` before implementation or visual design.

**Why:** StackLens should not become a dashboard whose behavior is invented by screens. Product behavior is defined independently and every later design or implementation choice must trace back to a requirement.

**Result:** stable requirement IDs such as `FR-017`, `SCORE-003`, and `SEC-001`.

## 2026-09-18 — Step 2: System architecture before frontend implementation

The architecture established a reusable deterministic analyzer, independent web/API/worker boundaries, and explicit evidence/scoring contracts.

**Why this matters to design:** the UI must render authoritative analyzer output rather than recreate product logic on the client. The report design therefore follows the structured concepts of facts, findings, recommendations, evidence, limitations, scores, and partial failures.

See [../architecture.md](../architecture.md).

## 2026-09-18 — Step 3: Frontend framework/tooling review

React + Vite + TanStack Router remains the MVP web architecture. Oxlint + Oxfmt replaced Biome. Next.js, T3, and TanStack Start were explicitly evaluated rather than ignored.

**Design implication:** StackLens does not depend on a framework-specific design model such as React Server Components. The design system must remain normal React/CSS architecture that could survive a future framework migration.

See [ADR-0005](../adr/0005-web-framework-and-tooling-review.md).

## 2026-09-18 — Step 4: Establish product-design principles

The interface direction is:

- developer-focused and information-dense without becoming visually noisy;
- evidence-first;
- calm and precise rather than futuristic/"AI scanner" themed;
- dark and light themes designed together;
- accessible without relying on color alone;
- honest about uncertainty and missing evidence.

See [principles.md](principles.md).

## 2026-09-18 — Step 5: Define MVP information architecture

The report is treated as the center of the product. The MVP journey is organized around:

`Input → Validation → Analysis progress → Report → Finding/Evidence detail`

The report hierarchy prioritizes:
1. state and limitations;
2. overall/category health;
3. urgent actions;
4. stack summary;
5. detailed findings by domain;
6. evidence and rule provenance.

See [information-architecture.md](information-architecture.md).

## 2026-09-18 — Step 6: Create low-fidelity wireframes

Wireframes were created before visual token decisions. They establish layout, hierarchy, navigation, and responsive behavior without committing to brand styling.

See [wireframes.md](wireframes.md).

## 2026-09-18 — Step 7: Establish the design-system strategy

Decision:
- StackLens owns its **tokens, visual language, product components, and patterns**.
- **shadcn/ui** is used as source-owned implementation scaffolding for generic UI primitives.
- New shadcn components use **Base UI** where appropriate.
- We do **not** hand-build complex accessible primitives such as dialogs, selects, popovers, menus, tooltips, comboboxes, or tabs unless a StackLens requirement cannot be satisfied by the underlying primitive.
- We **do** custom-design domain components such as `HealthScore`, `FindingCard`, `EvidencePanel`, `ConfidenceIndicator`, and `AnalysisLimitation`.

The token source adopts the DTCG JSON model so design values are not coupled directly to Tailwind classes.

See [design-system.md](design-system.md) and [ADR-0006](../adr/0006-design-system-and-prototyping.md).

## 2026-09-18 — Step 8: Define design tokens

The initial token set intentionally remains small:

- palette primitives;
- semantic light/dark colors;
- typography;
- spacing;
- radius;
- elevation;
- motion;
- StackLens-specific severity, evidence, confidence, and score semantics.

The canonical design-phase source is `design/tokens/stacklens.tokens.json`.

The CSS file beside it is a reference mapping for the prototype. During implementation, token generation should become automated rather than maintaining two independent token sources.

## 2026-09-18 — Step 9: Build disposable coded prototype

A standalone prototype was added at `design/prototype/index.html`.

It intentionally has no application framework or backend. Its purpose is to validate:
- hierarchy;
- visual density;
- light/dark semantics;
- input states;
- progress states;
- report navigation;
- scoring explanation;
- finding/evidence presentation;
- limitation visibility.

The prototype is disposable. Production code must be implemented later against the accepted architecture and contracts.

## Pending design-validation steps

Before product UI implementation:
- review the prototype visually on desktop and narrow viewport widths;
- verify text and semantic-color contrast;
- validate keyboard focus order and interaction expectations;
- decide final brand mark/logo separately from the system UI;
- create the first Figma design-system/prototype file once the target connected Figma workspace is unambiguous;
- translate accepted patterns into `packages/design-tokens` and `packages/ui`.

Any material design change should be appended to this journey rather than silently replacing the historical rationale.
