# JavaScript/TypeScript rule-package agent guidance

This file contains the original rule-package constraints moved from the root AGENTS.md,
**unchanged**, for selective loading. It applies to implementation and review of the rule package
and to dependent changes that alter rule behavior even when the edited file is outside this folder.
All root AGENTS.md guidance and accepted requirements/ADRs remain authoritative.
It is not a new product decision or permission to weaken existing validation.

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
- The FR-006/FR-007 npm rules may use version-specific provider metadata only when StackLens can
  establish an exact current Semantic Version from either an exact package.json declaration or
  matching FR-023 package-scoped shared-lockfile evidence, and the corresponding registry version record
  exists. Ranges without matching lockfile evidence, tags, URLs, workspace/link targets, stale
  lockfiles, and unsupported resolutions remain insufficient evidence.
- FR-006 compares supported exact declarations with npm's normalized `latest` dist-tag and must identify major/minor/patch/prerelease difference without implying that the upgrade is automatically recommended.
- Explicit npm deprecation is factual. Do not create an "unmaintained" heuristic without an accepted deterministic basis, explicit confidence, and insufficient-evidence behavior.
- FR-010 health facts must remain neutral source-backed signals unless a separate accepted rule defines a combined interpretation.
- FR-008 overlap findings must come from explicit supported capability-pair rules, remain heuristic when declaration evidence cannot establish actual redundant usage, and must not imply a package is unnecessary merely because another package is in the same broad category.
- FR-012 framework/tool facts must use deterministic supported evidence (currently exact declared package identities); do not guess roles from fuzzy package names.
- FR-013 configuration analysis is static only. Use diagnostic-checked JSONC for supported configs
  and strict JSON for manifests. Never import/execute JS/TS config. Resolve only bounded immutable
  local-tree references; opaque presets and dynamic fields remain unresolved at field level.
- Static project evidence for configuration should retain path/high-level findings only; do not copy configuration source content into report evidence.
- FR-009 source parsing must stay behind the StackLens parser adapter; parser-specific AST shapes must not leak into finding rules.
- FR-009 may use supported ESM imports/re-exports, static-string require/import(), explicit configuration/plugin conventions, and bounded package-script conventions as positive usage evidence. Never execute any of those inputs.
- Missing source references are usable for a potentially-unnecessary heuristic only when acquisition and parser coverage are complete. Tree/file/resource truncation, parse failures, unsupported dynamic references, or unavailable source evidence must suppress absence-based findings and remain explicit limitations.
- Potentially-unnecessary findings must remain heuristic and must not imply that removal is safe. Peer-only declarations are not sufficient candidates for non-use findings.
- The FR-011 rule may correlate only exact package/version OSV query evidence with dependency
  inventory facts. The exact current version may come directly from package.json or matching FR-023
  lockfile evidence; ranges without such evidence and unsupported targets remain insufficient.
- Withdrawn advisories are not active findings, incomplete OSV queries remain limited evidence, and complete empty queries never become a "secure" fact.
- Reuse `@stacklens/contracts` structured fact details rather than encoding required machine-readable
  dependency inventory only in prose.

- FR-014 migration opportunities must name deterministic current/target states and remain optional/heuristic unless evidence proves a migration is required. Do not turn every minor/patch update into a separate migration finding.
- Production priority is owned only by the configured `FindingPrioritizer`; detector rules must not embed urgency. Heuristic uncertainty may lower/cap priority but must never increase it.
- Recommendation rules consume finalized findings and their evidence. Keep advice separate from facts and do not imply an automatic repository change is safe.
- ADR-0013 supersedes the affected ADR-0012 scoring policy. Production v6 emits schema 2.0.0 and
  stack-health-v3. Risk bands depend on explicit deprecation or supported exact-version advisory
  severity, never finding priority. Updates, migrations, overlap and non-use advice are unscored.
- Named checks have pass/fail/unknown/not_applicable states. Missing required evidence blocks the
  category; not-applicable checks are excluded. Overall is the applicable mean capped by Dependencies
  and Security. Keep formulas exclusively in scoring and render supplied explanations in apps.
- Workspace paths define identity even when package names collide. Keep catalog constraints,
  importer resolutions, internal edges and peer constraints separate. Deduplicate provider requests
  without collapsing affected declarations. Non-use needs complete package/shared source coverage.
- MDX is parsed, never compiled. Bound config graphs to 16 levels/128 files and script graphs to
  16 levels/256 nodes within the global acquisition budget. Hidden config fields block only checks
  requiring them. Unsupported script binaries and ambiguous test selection prevent absence claims.
- Testing/Tooling scores describe supported static setup and reproducibility, never test results or
  runtime coverage. Custom scripts, unsupported package managers, and partial lockfile evidence stay
  limited. Absence-based test-file/lockfile findings require complete relevant acquisition.
- Concrete score weights/formulas live only in `packages/scoring`. React/Fastify/worker code must not recalculate priority or scores.
- OSV complete zero-match query evidence means only zero supported known-vulnerability matches for that exact query; never describe it as proof that a dependency/project is secure.
