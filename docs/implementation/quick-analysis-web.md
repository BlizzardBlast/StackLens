# Quick Analysis Web Flow

> **Status:** Implemented
> **Date:** 2026-09-22
> **Requirements:** FR-001, FR-002, FR-004, FR-005, FR-008, FR-012, FR-015, FR-016, FR-017, FR-021, FR-022, NFR-006, NFR-007, SEC-001, SEC-002, SEC-003, GOV-002, GOV-006, GOV-007
> **Architecture:** `apps/web -> public Fastify API -> analyzeQuickManifest`

## Purpose

Milestone K3 completes the anonymous `package.json` product path over the synchronous K2 HTTP
contract. It adds browser input and report presentation without moving validation or analysis policy
into React.

## Client boundary

The web client calls only:

```text
POST /v1/analyze/manifest
```

through an injectable `QuickAnalysisClient`.

The client validates successful payloads with the shared `AnalysisReportSchema`. It does not import
`apps/api`, analyzer packages, persistence, Worker, Graphile, provider adapters, priority policy, or
scoring policy.

## Input modes

The analyzer UI exposes the accepted Product Design v1 input-mode choice between GitHub repository
and `package.json`.

Within quick analysis:

- paste mode sends the exact entered text as `{ kind: "paste", content }`;
- file mode reads the selected browser `File` as text and sends
  `{ kind: "upload", filename, content }`.

No multipart transport exists. Both browser paths converge on the same Fastify/application analysis
path.

Client checks are deliberately narrow: empty paste/file selection can be rejected before a request,
but JSON parsing, manifest semantics, upload filename acceptance, and content bounds remain
authoritative on the server.

## Interaction states

Quick analysis is synchronous.

The UI therefore exposes:

- enabled input state;
- explicit request-busy state with disabled duplicate submission;
- recoverable authoritative validation errors that preserve entered/selected content;
- a terminal report on success.

It does not add repository polling, fabricated progress stages, percentages, persistence, or
background work.

## Design and accessibility

The implementation reuses StackLens semantic tokens, Button, AnalysisLimitation, EvidenceCoverage,
and FindingCard primitives/domain components.

The screen uses neutral surface hierarchy with restrained primary accents, an explicit input-mode
navigation, a structured three-step explanation rail, and responsive two-column composition on wide
screens. Narrow layouts collapse naturally to one column.

Controls are labeled, keyboard-focus visible, error state uses `role="alert"`, and synchronous
request state uses `aria-busy` plus polite live output. Status meaning never depends on color alone.

## Shared report composition

Report presentation now lives under `apps/web/src/features/analysis-report` rather than the
repository-analysis feature. Repository status rendering continues to consume it through a narrow
compatibility re-export, while quick analysis imports the shared renderer directly.

Manifest input receives an explicit early evidence-boundary panel:

- source evidence is unavailable;
- configuration evidence is unavailable;
- external provider evidence is unavailable in the quick snapshot;
- N/A means insufficient evidence, not a healthy result.

Immediately after that boundary, a manifest-specific **Verified from package.json** section surfaces
only analyzer-owned facts already present in the report:

- total normalized dependency declarations while preserving runtime/dev/peer/optional groups;
- supported exact-package framework/tool detections;
- a collapsed dependency declaration browser with preserved specifiers.

Curated overlap findings and any recommendations continue through the existing shared finding/report
components, so fact/heuristic/priority/evidence semantics remain analyzer-owned. The score section
also states that 0% in quick mode is **numeric-score evidence coverage**, not manifest parse
coverage.

The renderer still displays only contract/analyzer-owned scores, facts, findings, priority,
confidence, evidence, recommendations, limitations, and partial failures. React does not infer
technologies or recalculate analysis policy.

## Fastify compatibility

K3 requires no Fastify route change.

The existing route already follows the intended boundary: strict Zod request/response schemas,
OpenAPI generated from those schemas, bounded request content, stable public validation errors, and a
thin handler delegating to `analyzeQuickManifest`. Keeping K3 web-only avoids duplicating or
weakening that server responsibility.

## Verification

Focused tests cover:

- paste request shape and contract-valid response parsing;
- upload filename + text JSON request shape;
- stable server validation errors;
- invalid success payload rejection;
- pasted-content preservation;
- local file reading and submission;
- accessible synchronous busy state with no fake percentage;
- manifest-only evidence-boundary, analyzer-backed insight presentation, and numeric-score coverage
  clarification.

Repository-wide `pnpm check` remains the merge gate.
