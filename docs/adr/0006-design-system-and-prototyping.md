# ADR-0006: Design system and prototyping strategy

- **Status:** Accepted
- **Date:** 2026-09-18
- **Requirements:** FR-001–FR-004, FR-015–FR-022, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-006, NFR-007, NFR-008, GOV-006

## Context

StackLens requires a UI that communicates technical findings, provenance, uncertainty, severity, confidence, limitations, and explainable scores.

Using an off-the-shelf component aesthetic without an explicit design system risks:
- inconsistent semantics;
- inaccessible status communication;
- generic dashboard styling;
- ad-hoc Tailwind values;
- fact/recommendation ambiguity;
- duplicated interaction primitives;
- design drift between prototype and implementation.

Building every interaction primitive from scratch would also spend engineering effort on non-differentiating accessibility/focus/keyboard behavior.

## Decision

### StackLens owns its design system

StackLens will define and own:
- product-design principles;
- information architecture;
- semantic design tokens;
- light/dark themes;
- typography and spacing rules;
- domain components;
- report patterns;
- responsive behavior.

### shadcn/ui is an implementation foundation, not the design system

Use shadcn/ui selectively for source-owned generic React components.

For new primitives, prefer the **Base UI** flavor unless a concrete requirement or component limitation makes another base preferable.

Generated code must be mapped to StackLens tokens and APIs rather than copied into product screens unchanged.

### Do not build complex generic primitives from scratch by default

Do not custom-implement dialogs, menus, popovers, selects, comboboxes, tooltips, tabs, and similar interaction primitives unless an accepted requirement cannot be satisfied with the selected accessible primitive.

### Build StackLens domain components ourselves

Domain-specific semantics are custom product components, including:
- health scores;
- finding cards;
- evidence panels;
- confidence indicators;
- limitations;
- dependency health rows;
- migration opportunities;
- score contribution ledgers.

### Use semantic design tokens

The design-phase canonical source is a DTCG-style JSON file.

The implementation should later automate transformations into CSS/Tailwind-consumable variables rather than duplicating token values manually.

### Prototype before production UI

Low-fidelity wireframes and a disposable coded prototype are required before production screen implementation.

The prototype validates hierarchy and visual language but is not production code.

## Why shadcn/ui + Base UI

Current shadcn/ui defaults new projects to Base UI while keeping Radix supported.

Base UI provides accessible behavior for complex primitives including keyboard navigation, ARIA roles/attributes, pointer interaction, and focus management.

This lets StackLens spend custom-design effort on its actual product semantics.

## Why not shadcn/ui alone

shadcn/ui cannot define StackLens's product semantics.

A default component collection does not answer:
- how facts differ from heuristics;
- how evidence is exposed;
- what insufficient evidence looks like;
- how a score explains itself;
- how severity and confidence interact;
- how technical-density rules work.

Those remain StackLens design-system responsibilities.

## Token format

Use the Design Tokens Community Group model where practical.

The DTCG published its first stable format specification in 2025. This provides a vendor-neutral representation suitable for future design/code tooling.

## Design workspace

Figma is **not required** for the StackLens design workflow.

The repository-native artifacts are the durable and sufficient design source of truth:
- requirements;
- design principles;
- ADRs;
- token definitions;
- low-fidelity wireframes;
- coded prototype;
- design reviews;
- journey log.

A visual editor may be used later if it materially improves a specific design task, but implementation and design progress must not depend on an external rate-limited workspace.

## Consequences

### Positive
- consistent domain semantics;
- accessible generic primitives without reinventing them;
- source-owned component code;
- visual identity is independent from shadcn defaults;
- tokens can flow across Figma/code tooling;
- design rationale remains reviewable in Git.

### Negative
- requires design-system governance even for a small MVP;
- shadcn-generated code may need deliberate normalization;
- token transformation tooling must be added later;
- coded prototype creates disposable work that must not accidentally become production code.

The cost is accepted because the report UX is central to whether StackLens's evidence model is understandable.
