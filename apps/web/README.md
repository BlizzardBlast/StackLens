# StackLens web

The production web client for StackLens.

## Responsibility

`apps/web` is a React 19 + Vite client of the public Fastify API. The first production slice covers
the public-repository flow:

1. submit a public repository URL to `POST /v1/analyses/repository`;
2. navigate to the stable analysis route;
3. poll `GET /v1/analyses/:analysisId` with TanStack Query while the analysis is non-terminal;
4. show the server's coarse progress stage without inventing percentage progress;
5. distinguish total failure from `completed_with_limitations`;
6. render the persisted `AnalysisReport` using shared contract data and `@stacklens/ui` components.

The web app does not call GitHub, npm, or OSV directly and does not import Worker, Graphile, or
persistence internals. It never recalculates analyzer priority or stack-health scores.

## Development

For the full local stack, run from the repository root:

```bash
pnpm dev:infra
pnpm dev
```

To run only the web client when an API is already listening on port 3000:

```bash
pnpm --filter @stacklens/web dev
```

Vite proxies `/v1` to `http://127.0.0.1:3000` for local development. Production defaults to
same-origin API requests. A deployment may provide `VITE_STACKLENS_API_BASE_URL` when its network
and CORS boundary explicitly supports a separate API origin.

## Testing

Focused tests cover:

- request/response contract parsing;
- advisory client-side URL validation;
- input preservation across authoritative server errors;
- stage-only progress;
- terminal failure;
- completed-with-limitations report rendering;
- evidence disclosure from contract data.

The repository-wide `pnpm check` remains the completion gate.

**Traceability:** FR-003, FR-004, FR-017, FR-021, DATA-001–DATA-006, SCORE-001–SCORE-004,
NFR-003, NFR-006, NFR-007, NFR-008, SEC-001, SEC-002, SEC-003, SEC-007, GOV-002, GOV-006,
GOV-007.
