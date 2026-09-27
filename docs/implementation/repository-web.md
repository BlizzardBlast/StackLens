# Repository Analysis Web Flow

> **Status:** Implemented Milestone K1 baseline  
> **Date:** 2026-09-21  
> **Requirements:** FR-003, FR-004, FR-017, FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004, NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006, GOV-007  
> **Architecture:** `apps/web -> apps/api -> @stacklens/repository-jobs/@stacklens/persistence`

## Purpose

Milestone K1 makes the existing J3 repository-analysis HTTP contract usable from the first production
React application without moving analyzer, scoring, provider, queue, or persistence policy into the
browser.

The implementation deliberately proves one bounded path:

```text
public GitHub URL
    -> POST /v1/analyses/repository
    -> /analyses/:analysisId
    -> TanStack Query polling
    -> coarse durable progress
    -> failed | completed_with_limitations | completed
    -> persisted AnalysisReport rendering
```

Quick-manifest transport and UI were implemented later as K2/K3 and remain a separate synchronous
execution path. See [Quick Analysis Web Flow](quick-analysis-web.md).

## Client boundary

`repository-analysis-api.ts` owns the web transport adapter.

It:

- exposes a small `RepositoryAnalysisClient` interface for dependency inversion and focused tests;
- accepts an injectable `fetch` implementation;
- forwards `AbortSignal` from TanStack Query to polling requests;
- validates successful transport payloads with Zod;
- validates terminal reports with the shared `AnalysisReportSchema`;
- maps public API errors to a stable client error without exposing lower-level implementation details;
- encodes the analysis identifier before putting it into the status URL.

The adapter intentionally duplicates only the public HTTP response vocabulary needed by the client.
It does not import `@stacklens/persistence`, Graphile Worker types, or provider adapters.

## Submission and validation

The repository form performs only obvious advisory checks that are safe for the client to own:

- non-empty input;
- syntactically valid URL;
- HTTPS scheme.

The Fastify API remains authoritative for GitHub-host/path/ref support. Server validation errors are
shown inline while preserving the user's entered value.

This avoids creating a second browser implementation of the repository URL policy.

## Polling and progress

TanStack Query owns server-state polling.

The analysis route polls every 1.5 seconds only while status is non-terminal. Polling stops for:

- `completed`;
- `completed_with_limitations`;
- `failed`.

The UI renders the actual server `progressStage` as named stages. It never converts those stages
into a fabricated percentage.

The submission mutation now exposes a visible busy state from the moment a valid repository is
submitted until the stable analysis route opens. The first status fetch has its own preparing state,
and active analysis presents the server stages as an accessible timeline with explicit
done/current/waiting labels plus a live current-stage explanation. Numbered stage markers use a
fixed-size, line-height-neutral flex box so single-digit numerals remain visually centered. The
current row adds a restrained pulsing semantic-primary surface layer while keeping its text stable;
the animation is disabled by reduced-motion preferences and never implies measurable numeric
progress.

Transient status failures use a bounded retry policy. A public `404` is not repeatedly retried.
Users can explicitly retry a failed status fetch.

## Report rendering

The report screen consumes analyzer-owned data as-is.

It renders:

- overall and category score values or explicit `N/A`;
- available-category count, stated scoring scopes, and observed repository acquisition counts;
- finding classification, priority, confidence, rule identity, and description;
- evidence referenced by each finding;
- separate recommendations;
- grouped limitations and actionable partial failures, before the long findings list.

React does not reorder findings by a new local priority policy, calculate scores, assign score
categories, infer finding confidence, or convert missing evidence into numeric values.

The existing `@stacklens/ui` domain components remain the shared product vocabulary. K1 uses
`FindingCard` and `AnalysisLimitation` while keeping screen composition in
`apps/web`.

Under ADR-0012, score eligibility is not displayed as a measured evidence percentage. Each category
states its supported scope and exposes a native keyboard-accessible disclosure: the analyzer's
contribution ledger for available scores, or links to blocking limitations for N/A. Equal
kind/message notices share one display group while retaining their original IDs and rule/category
references. Each group distinguishes related analysis areas from scores actually blocked, using
the report's limitation references rather than inferring policy in React.

Stored `stack-health-v1` reports keep their values. Their three unimplemented category policies are
explicitly labeled rather than suggesting that more repository data would unlock them. A fresh
analysis is required for v2; reports are not rewritten on read. See [report evidence design](../design/report-evidence.md).

## Accessibility and responsive behavior

K1 follows Design v1's structural accessibility rules:

- every form control has a programmatic label;
- validation and terminal failures use alert semantics;
- submission and progress changes are announced with status semantics without percentage claims;
- focus moves to newly disclosed evidence detail;
- interactive targets preserve the shared minimum sizes;
- narrow layouts retain the same content order without requiring a desktop navigation rail;
- status and finding meaning is communicated with text, not color alone.

## Testing

Focused tests use synthetic responses and a contract-valid bounded report fixture. They cover:

- submission payload shape;
- shared report-schema validation;
- stable server-error propagation;
- advisory client validation and input preservation;
- stage-only progress, centered stage-marker treatment, and reduced-motion-safe active feedback;
- total terminal failure;
- completed-with-limitations report rendering;
- evidence disclosure.

MVP acceptance hardening additionally exercises the production TanStack Router tree across the quick
and repository input modes. The smoke test mocks only the client network methods, then verifies
package.json submission -> manifest report -> analyzer home -> repository submission -> stable
analysis route -> terminal report.

No live GitHub, npm, OSV, Worker, or database dependency is required for web component or
production-router acceptance tests.

## Deployment notes

The Vite development server proxies `/v1` to the local Fastify server on port 3000.

Production requests are same-origin by default. `VITE_STACKLENS_API_BASE_URL` may be used only when
the deployment provides the corresponding cross-origin network/CORS policy; K1 does not weaken the
Fastify transport boundary merely to support a development topology.

## Out of scope

K1 does not add:

- private GitHub authentication;
- saved repositories or history;
- Graphile job identifiers in client state;
- browser calls to GitHub/npm/OSV;
- client-owned analyzer/scoring logic;
- code execution or dependency installation;
- source/config/provider response persistence.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006,
GOV-007.
