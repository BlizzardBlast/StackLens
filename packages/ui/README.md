# @stacklens/ui

StackLens's shared UI layer.

## Responsibility

This package contains:

- source-owned generic primitives based on shadcn/ui + Base UI;
- StackLens domain components;
- the Tailwind CSS v4 stylesheet that consumes `@stacklens/design-tokens`.

It does **not** contain product screens or analyzer business logic.

## Component policy

Generic interaction primitives should follow ADR-0006:

- use shadcn/ui source patterns;
- prefer Base UI for new interactive primitives;
- preserve StackLens token semantics;
- import `cn` directly from the `cn` package when class composition is needed;
- do not hand-build focus/keyboard/modal behavior when an accepted primitive exists.

Domain components should accept product semantics rather than raw colors.

For example, prefer:

```tsx
<SeverityBadge priority="high" />
```

over:

```tsx
<span className="text-orange-...">High</span>
```

## Initial components

Generic:

- `Button`
- `Badge`

Domain:

- `FindingTypeBadge`
- `SeverityBadge`
- `ConfidenceIndicator`
- `EvidenceCoverage`
- `HealthScore`
- `AnalysisLimitation`
- `FindingCard`

The domain layer intentionally does not derive analyzer/scoring decisions. For example, `HealthScore` receives an explicit state rather than inventing score thresholds in the UI.

**Traceability:** FR-015–FR-021, DATA-004–DATA-005, SCORE-001–SCORE-003, NFR-006–NFR-007, ADR-0006.

## Utility policy

Do not create a local utility module merely to re-export a dependency. In particular, shared components import `cn` directly from `"cn"`.

Add a local utility only when StackLens owns meaningful behavior that cannot be expressed clearly at the call site.
