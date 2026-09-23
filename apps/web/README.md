# StackLens web

The production React 19 + Vite client for StackLens.

## Responsibility

`apps/web` is a replaceable client of the public Fastify API. It now exposes both accepted anonymous
MVP input modes:

1. **public GitHub repository** — submit to `POST /v1/analyses/repository`, navigate to a stable
   analysis route, poll durable status with TanStack Query, and render the terminal report;
2. **quick package.json** — paste manifest text or read a selected local `package.json` in the
   browser, submit the existing JSON contract to `POST /v1/analyze/manifest`, and render the
   synchronous report without polling or persistence.

Both modes runtime-validate `AnalysisReport` data through `@stacklens/contracts` and share one
report renderer. React displays analyzer-owned findings, priority, confidence, evidence,
recommendations, limitations, and scores without reconstructing analysis policy.

The browser does not call GitHub, npm, or OSV directly and does not import API implementation,
Worker, Graphile, persistence, analyzer, priority, or scoring internals.

## Analyzer input UX

The analyzer surface follows Product Design v1 with an explicit input-mode navigation between
repository and `package.json` analysis.

Quick analysis intentionally keeps two browser input choices behind one server contract:

- **Paste manifest** sends `{ kind: "paste", content }`;
- **Choose local file** reads the file text locally, then sends
  `{ kind: "upload", filename, content }`.

The web client performs only obvious empty-input checks. JSON shape, manifest semantics, filename
rules, and request bounds remain authoritative in Fastify/application validation. Recoverable server
errors preserve the user's entered or selected content.

Quick analysis uses an accessible synchronous busy state. It does not invent repository-style
stages, percentages, background jobs, or polling.

## Report presentation

Repository and manifest analysis reuse the shared web report composition under
`src/features/analysis-report`.

Manifest reports include an early evidence-boundary explanation so N/A scores cannot be interpreted
as healthy. Source/configuration/provider gaps stay visible as insufficient evidence and
limitations. A **Verified from package.json** section then surfaces analyzer-owned dependency
inventory and supported framework/tool facts before the score cards. Quick-mode 0% is explicitly
described as numeric-score evidence coverage rather than manifest parse coverage.

## Development

For the full local stack:

```bash
pnpm dev:infra
pnpm dev
```

The root `pnpm dev` command automatically prepares shared workspace dependencies before starting
web/API/worker watch processes. Turbo reuses cached outputs when possible; a fresh checkout does not
need a separate `pnpm build`.

To run only the web client when the API already listens on port 3000:

```bash
pnpm dev:prepare
pnpm --filter @stacklens/web dev
```

Vite proxies `/v1` to `http://127.0.0.1:3000` locally. Production defaults to same-origin API
requests. `VITE_STACKLENS_API_BASE_URL` may be provided only when the deployment explicitly supports
a separate API origin.

## Testing

Focused tests cover:

- repository request/response parsing and polling semantics;
- advisory repository URL validation;
- quick paste and upload JSON contracts;
- local file reading without multipart transport;
- authoritative server-error preservation;
- invalid API/report payload rejection;
- accessible submission busy states without fake percentages;
- terminal repository failure and completed-with-limitations rendering;
- shared evidence/report disclosure;
- explicit manifest-only insufficient-evidence messaging and analyzer-backed insight presentation;
- a production-router acceptance smoke that traverses package.json analysis, returns to the analyzer,
  submits a repository, navigates to the stable analysis route, and renders a terminal report.

The acceptance smoke uses the real production route tree and real web client singletons while mocking
only their network methods. This verifies route composition without depending on live providers.

The repository-wide `pnpm check` remains the completion gate.

**Traceability:** FR-001–FR-004, FR-017, FR-021, FR-022, DATA-001–DATA-006,
SCORE-001–SCORE-004, NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007,
GOV-002, GOV-006, GOV-007.
