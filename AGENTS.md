# StackLens agent instructions

These instructions apply to automated coding agents working anywhere in this repository.

## Read before changing behavior

Read the smallest relevant set of source-of-truth documents before editing code:

- `README.md` for product scope and repository status.
- `docs/requirements.md` for accepted product/system behavior.
- `CONTRIBUTING.md` for traceability and development rules.
- `docs/architecture.md` and relevant files under `docs/adr/` for architecture decisions.
- `docs/design/` and ADR-0006/ADR-0007 for design-system or UI work.

Requirements define **what** StackLens does. Architecture and implementation define **how** it does it. Do not silently create product behavior in code.

## Requirements and traceability

- Every product implementation task, PR, and acceptance test must reference applicable requirement IDs per **GOV-002**.
- If requested behavior is not covered by an accepted requirement, update the requirement first or in the same change per **GOV-003**.
- Keep architecture decisions subordinate to requirements per **GOV-006**.
- Do not encode new scoring thresholds, severities, confidence levels, recommendations, or evidence rules in presentation components.

## Workspace and commands

Use pnpm from the repository root.

Common verification commands:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm check
```

Run `pnpm check` before considering implementation work complete when the full suite is practical.


For local end-to-end repository analysis:

```sh
pnpm dev:infra
pnpm dev
```

`compose.yaml` owns only local PostgreSQL. The web, API, and worker remain normal pnpm workspace
processes. Keep process bootstrap/composition in app runtime entrypoints; do not move analyzer,
priority, recommendation, or scoring policy into `main.ts` or infrastructure wiring.

Do not replace pnpm, Turborepo, TypeScript, Oxlint, Oxfmt, Vitest, Tailwind CSS, shadcn/ui, or Base UI without an architecture decision that explains the requirement impact.

## TypeScript

- Keep `tsconfig.base.json` runtime-neutral. Runtime-specific module, lib, JSX, and target settings belong in package/app tsconfigs.
- Preserve strict mode, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `verbatimModuleSyntax`.
- The UI package is bundler-targeted and uses package `imports` aliases.
- Prefer `import type` when an import is only used as a type.
- Do not weaken compiler settings just to make a local error disappear.

## Turborepo

- Declare files outside a package that affect a task as Turbo inputs/global dependencies so cache hits remain correct.
- Only declare task outputs that are actually produced.
- Generated design-token output belongs to the `build` task.
- Keep local Turbo cache artifacts out of source control.

## shadcn/ui and Base UI

StackLens owns its visual language. shadcn/ui is source scaffolding for generic accessible primitives; Base UI is the preferred primitive layer for new complex interactions.

- shadcn configuration lives at `packages/ui/components.json`.
- Add a component from the repository root with:

  ```sh
  pnpm ui:add -- <component>
  ```

- Review generated source before committing it.
- Map generated components to StackLens semantic tokens and sizing/accessibility rules.
- Do not bulk-add unused components.
- Do not hand-build dialogs, menus, popovers, selects, comboboxes, tooltips, or tabs when the accepted primitive can satisfy the requirement.
- Generic reusable primitives belong in `packages/ui/src/components/`.
- StackLens-specific semantics belong in `packages/ui/src/domain/`.

## Design tokens

The canonical editable token source is:

`design/tokens/stacklens.tokens.json`

Do not hand-edit `packages/design-tokens/dist/`. It is generated and ignored by Git.

When tokens change, run the build and tests. Product UI should consume semantic/domain tokens rather than raw palette values whenever a semantic token exists.

## Shared analysis contracts

The authoritative serialized analysis-domain model lives in `packages/contracts`.

- Reuse contract schemas/types rather than redefining finding, confidence, priority, category, evidence, limitation, recommendation, or score vocabulary in apps/packages.
- Keep contracts framework-agnostic: no React, Fastify, database, provider-client, or analyzer implementation dependencies.
- React/UI code should use type-only imports when it only needs domain vocabulary.
- Facts, findings, and recommendations are distinct. Recommendations must never be added back as a finding classification.
- N/A / insufficient evidence must remain structurally distinct from a numeric score of zero.
- Breaking serialized report changes require a schema-version change and ADR/architecture review.

## Analyzer core rules

The reusable orchestration layer lives in `packages/analyzer-core`.

- Keep ecosystem-specific detection out of analyzer-core.
- Fact rules emit facts; finding rules emit findings; recommendation rules emit recommendations. Do not collapse these stages.
- Rules must remain synchronous and free of provider/network I/O.
- Same-stage rules must not depend on sibling output or registration order.
- Rule IDs/versions are stable product data.
- Every rule must declare requirement IDs and emitted entities must stay within that declaration.
- Do not catch rule failures inside product rules merely to hide them; analyzer-core owns rule-level partial-failure isolation.
- Scoring formulas belong in `packages/scoring`; analyzer-core depends only on `AnalysisScorer`.
- Do not create timestamps/random IDs inside analyzer-core. Callers supply nondeterministic values.

## Analyzer core boundaries

The reusable analyzer execution layer lives in `packages/analyzer-core`.

- Keep fact, finding-candidate, priority, recommendation, and scoring responsibilities separate.
- Fact rules emit facts only.
- Finding rules emit finding candidates and **must not** embed `priority`.
- The configured `FindingPrioritizer` is the only analyzer stage that creates `FindingPriority`.
- Recommendation rules consume finalized findings; they do not calculate priority or scores.
- Scoring policy stays behind `AnalysisScorer`; analyzer-core must not define score weights/bands/deductions.
- Rule/prioritizer/scorer evaluation remains synchronous. Provider/network I/O happens before analyzer-core.
- Treat project and metadata snapshots as immutable; rule contexts expose them through `DeepReadonly`.
- Reuse `@stacklens/contracts` entities instead of creating parallel public finding/report shapes.
- Invalid rule output must be isolated rather than silently normalized.
- Priority-policy changes must be reflected in the versioned rule set.

## JavaScript/TypeScript rule package

Ecosystem-specific JavaScript/TypeScript normalization and deterministic rules live in
`packages/rules-javascript`.

- Preserve exact declared dependency specifiers; do not relabel ranges/tags/URLs as installed versions.
- Keep dependency groups explicit and do not silently merge declarations across groups.
- Reject malformed manifest groups/values instead of coercing them.
- Create project evidence without fabricated line numbers.
- Keep npm/OSV/GitHub/provider I/O outside rule evaluation.
- Provider-backed JS rules consume normalized analyzer metadata; do not add a `rules-javascript -> data-sources` dependency.
- Bind provider-backed analyzer metadata to the exact report-level `DataSource.id` that produced it,
  and require external evidence used by a rule to reference that same source.
- The FR-006/FR-007 npm rules may use version-specific provider metadata only when the project has an exact supported Semantic Version declaration and the matching registry version record. Declared ranges/tags/URLs/workspace specifiers remain insufficient evidence until a resolved-version source exists.
- FR-006 compares supported exact declarations with npm's normalized `latest` dist-tag and must identify major/minor/patch/prerelease difference without implying that the upgrade is automatically recommended.
- Explicit npm deprecation is factual. Do not create an "unmaintained" heuristic without an accepted deterministic basis, explicit confidence, and insufficient-evidence behavior.
- FR-010 health facts must remain neutral source-backed signals unless a separate accepted rule defines a combined interpretation.
- FR-008 overlap findings must come from explicit supported capability-pair rules, remain heuristic when declaration evidence cannot establish actual redundant usage, and must not imply a package is unnecessary merely because another package is in the same broad category.
- FR-012 framework/tool facts must use deterministic supported evidence (currently exact declared package identities); do not guess roles from fuzzy package names.
- FR-013 configuration analysis is static only. Repository-file snapshots are already-acquired input; never import/execute JS/TS config. Dynamic/JSONC/unsupported shapes must remain partial/limited rather than guessed.
- Static project evidence for configuration should retain path/high-level findings only; do not copy configuration source content into report evidence.
- FR-009 source parsing must stay behind the StackLens parser adapter; parser-specific AST shapes must not leak into finding rules.
- FR-009 may use supported ESM imports/re-exports, static-string require/import(), explicit configuration/plugin conventions, and bounded package-script conventions as positive usage evidence. Never execute any of those inputs.
- Missing source references are usable for a potentially-unnecessary heuristic only when acquisition and parser coverage are complete. Tree/file/resource truncation, parse failures, unsupported dynamic references, or unavailable source evidence must suppress absence-based findings and remain explicit limitations.
- Potentially-unnecessary findings must remain heuristic and must not imply that removal is safe. Peer-only declarations are not sufficient candidates for non-use findings.
- The FR-011 rule may correlate only exact package/version OSV query evidence with dependency inventory facts. Declared ranges/tags remain insufficient evidence until a resolved-version source exists.
- Withdrawn advisories are not active findings, incomplete OSV queries remain limited evidence, and complete empty queries never become a "secure" fact.
- Reuse `@stacklens/contracts` structured fact details rather than encoding required machine-readable
  dependency inventory only in prose.

- FR-014 migration opportunities must name deterministic current/target states and remain optional/heuristic unless evidence proves a migration is required. Do not turn every minor/patch update into a separate migration finding.
- Production priority is owned only by the configured `FindingPrioritizer`; detector rules must not embed urgency. Heuristic uncertainty may lower/cap priority but must never increase it.
- Recommendation rules consume finalized findings and their evidence. Keep advice separate from facts and do not imply an automatic repository change is safe.
- Category scores require explicit coverage facts plus no material limitation for that category. Missing/partial provider, source, configuration, or exact-version evidence must produce N/A/insufficient evidence instead of a deduction.
- Concrete score weights/formulas live only in `packages/scoring`. React/Fastify/worker code must not recalculate priority or scores.
- OSV complete zero-match query evidence means only zero supported known-vulnerability matches for that exact query; never describe it as proof that a dependency/project is secure.

## External data-source adapters

External provider integration lives in `packages/data-sources`.

- Provider/network I/O must stay outside analyzer rules.
- Treat every provider payload as untrusted and validate package identity plus required metadata before exposing normalized data.
- Use fixed/allowlisted provider hosts; do not turn analyzed package fields into arbitrary fetch targets.
- Enforce explicit request timeout and response-size limits.
- Preserve provenance and retrieval timestamps with `@stacklens/contracts` data-source/evidence shapes.
- Provider/network/schema failures must become typed partial failures, never false facts or silent empty data.
- Do not include raw provider bodies or low-level network error details in public failure messages/logging.
- Publisher-controlled URLs such as package repository/homepage values are metadata only until separately validated for presentation under **SEC-008**.
- OSV npm queries require exact semantic version evidence. Never send a declared range/tag such as `^1.2.3` or `latest` as though it were an installed version.
- Preserve OSV query completeness: incomplete pagination/detail acquisition is partial evidence, and an empty match set is never proof that a package is secure.
- Public GitHub acquisition must validate github.com repository URLs, resolve an immutable commit before file reads, use fixed api.github.com endpoints, disable redirects, and read selected files by immutable blob SHA.
- GitHub snapshot acquisition must enforce request/file-count/per-file/aggregate byte bounds. Root package.json is prioritized before optional config files.
- Never follow repository symlinks, traverse submodules, dereference Git LFS, or fetch generated/vendor analysis files merely because their names match supported configs.
- Keep GitHub full file bodies transient: do not copy source/config content into provider evidence, limitations, partial failures, or logs. Repository rules consume the already-acquired snapshot later.
- PR tests use synthetic/recorded provider responses; normal PR correctness must not depend on live external services.

## Web application boundary

The production web application lives in `apps/web`.

- Keep it a replaceable client of the public Fastify REST contract; never import `apps/api`,
  `apps/worker`, `@stacklens/persistence`, or Graphile internals into browser code.
- TanStack Query owns remote repository-analysis state. Forward its `AbortSignal` to fetch and stop
  polling when the public status becomes terminal.
- Client-side repository URL checks are advisory only. Do not duplicate the authoritative GitHub URL
  parser/canonicalizer from the server.
- Runtime-validate terminal `AnalysisReport` payloads with `@stacklens/contracts`; do not create a
  parallel report shape in React.
- Render analyzer-owned classification, priority, confidence, evidence, recommendations, and scores
  as supplied. Do not calculate replacement severity/priority/scoring rules in presentation code.
- Show coarse named progress stages only. Never derive fake percentages from stage position.
- Keep total failure visually and semantically distinct from
  `completed_with_limitations`.
- Reuse `@stacklens/ui` and semantic tokens for product meaning. Screen composition belongs in
  `apps/web`; shared UI packages must not grow route/server-state behavior.
- Preserve Design v1 accessibility and responsive requirements: labeled controls, alert/live
  semantics where appropriate, keyboard-visible focus, text labels for status meaning, and useful
  narrow layouts.
- Web tests use synthetic API responses and contract-valid report fixtures; normal PR correctness
  must not depend on live providers or a browser talking to production services.

See `docs/implementation/repository-web.md`.

## API application boundary

The API application layer lives in `apps/api`.

- Keep authoritative request/input validation at this boundary; client-side checks are advisory.
- Reuse `packages/rules-javascript` normalization/evidence helpers instead of duplicating manifest semantics.
- Keep analyzer construction/policy injectable. Do not define production scoring weights or priority formulas in the API.
- Quick manifest analysis must not require authentication or persistence.
- Do not retain or log full manifest content by default. Keep only data needed for the report plus the input fingerprint.
- Stable validation errors should be transport-agnostic so Fastify can map them without changing analyzer behavior.
- Provider/network collection happens before analyzer-core and must remain outside rule evaluation.
- Repository-analysis Fastify routes must create/enqueue through `@stacklens/repository-jobs` and
  read durable state through `@stacklens/persistence`; never import `apps/worker`, query Graphile
  internal tables, or duplicate `@stacklens/analysis-orchestration`.
- Keep Fastify request/response validation and generated OpenAPI aligned by using the same Zod route
  schemas. Public polling responses expose coarse StackLens status/progress and terminal
  report/failure only, not active Graphile job identifiers or retry internals.

## Analysis orchestration package

Shared hosted-analysis composition lives in `packages/analysis-orchestration`.

- Keep it transport- and persistence-independent so API and Worker can both consume it.
- This package may sequence injected GitHub/npm/OSV providers before analyzer-core; it must not hide provider I/O inside rules.
- Keep production analyzer composition here rather than reconstructing rule/prioritizer/recommendation/scorer sets in Fastify routes or Worker handlers.
- Preserve unavailable/partial providers as report sources/partial failures and let rules/scoring emit limitations; never translate missing data into clean conclusions.
- Repository manifest/source bodies are transient construction input only. Do not place them in progress events, application errors, logs, persistence payloads, or returned reports.
- OSV orchestration may query only deterministic exact semantic-version declarations; do not reinterpret ranges/tags as installed versions.
- Bound metadata acquisition deterministically. Resource-limit truncation must become an explicit limitation, never negative evidence.
- Progress events expose phase/count/failure state only. Durable Graphile Worker/PostgreSQL job state is implemented outside this package through `@stacklens/repository-jobs`, `@stacklens/persistence`, and `apps/worker`.

## Persistence and repository job boundaries

Durable hosted repository-analysis state lives in `packages/persistence`,
`packages/repository-jobs`, and `apps/worker`.

- `@stacklens/persistence` owns the Drizzle/PostgreSQL analysis/report schema and repository methods.
- `@stacklens/repository-jobs` owns the minimal queue payload, task identifier, enqueue seam, and
  transient-progress → durable-stage mapping. Keep this package reusable by API code; it must not
  import the Worker application.
- `apps/worker` owns Graphile Worker runtime/task execution and production provider wiring. It must
  consume `@stacklens/analysis-orchestration`; never reconstruct analyzer policy or provider
  sequencing.
- Job payloads may contain only stable identifiers/public repository metadata required to execute the
  analysis. Reject unknown payload fields; never persist repository source, manifest bodies, scripts,
  provider response bodies, or secrets in the queue.
- Treat Graphile delivery as at-least-once. Progress and terminal writes must be bound to the current
  Graphile job ownership claim so stale/duplicate jobs cannot overwrite active work.
- Retryable failures should return to Graphile before the final attempt. On the final attempt, persist
  StackLens terminal failure state and finish the queue task so a permafailed Graphile row is not the
  only durable failure record.
- Provider partial failures that still produce a report remain report limitations/partial failures;
  do not turn them into whole-job failure.
- PostgreSQL timestamps leaving the persistence repository must be normalized to ISO 8601.
- Keep Fastify transport and React status polling outside persistence/worker packages.

## Analyzer safety

Analyzed repositories are untrusted input.

Per **SEC-001** and **SEC-002**, MVP analysis must not execute arbitrary repository code, package scripts, builds, tests, hooks, or dependency installation.

Do not introduce an execution path that violates this boundary.

## Tests and quality

- Add focused tests for new behavior.
- Analysis rules must be independently testable.
- Heuristics must cover both positive findings and insufficient-evidence cases.
- UI accessibility semantics must not rely on color alone.
- Fix lint/type/test failures at the source instead of suppressing them globally unless the rule is genuinely inappropriate for the repository.

## Documentation completion gate

Documentation is part of the change. Before reporting work as complete, every agent must perform a documentation-impact pass according to `docs/documentation-governance.md`.

For **every pull request**:

- append the chronological step to `docs/design/journey.md`;
- state what changed, why, and meaningful verification;
- update `docs/requirements.md` when accepted behavior changes;
- update architecture/ADRs when architecture or technology decisions change;
- update design documents when tokens, UI semantics, accessibility patterns, or interaction decisions change;
- update implementation/contributor/agent documentation when tooling, CI, packages, editor setup, or workflow changes;
- update `README.md` when its public status or guidance would become stale.

Do not finish with knowingly stale documentation. Do not rewrite historical journey entries to hide earlier decisions; append corrections as new steps.

Before merging, complete the handover inside the same PR. Do not leave a placeholder that requires a
second post-merge documentation PR merely to insert an unknowable squash-merge SHA. Reference the
milestone PR and require the next session to resolve/verify the current `main` HEAD instead.

## Generated and historical artifacts

- `design/prototype/` is disposable design-validation code, not production implementation.
- The project-wide journey lives at `docs/design/journey.md`; append every PR as a new chronological step rather than rewriting history.
- Generated token output is recreated by package scripts and is not a second source of truth.
