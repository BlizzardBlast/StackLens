# StackLens Product & System Requirements

> **Status:** Accepted baseline  
> **Version:** 0.1.1  
> **Last updated:** 2026-09-19  
> **Product:** StackLens  
> **Repository:** BlizzardBlast/StackLens

## 1. Purpose and authority

This document is the source of truth for StackLens product behavior and system-level expectations.

All product work must be traceable to one or more requirement IDs in this document. A feature, behavioral change, bug fix, acceptance test, implementation task, or pull request must not introduce product behavior that cannot be traced to an accepted requirement.

When implementation and this document disagree, the accepted requirement is authoritative until the requirement itself is deliberately changed.

### Requirement lifecycle

Requirements use these lifecycle states:

- **Accepted** — approved and valid.
- **Implemented** — code exists that claims to satisfy the requirement.
- **Verified** — acceptance criteria have automated or documented verification.
- **Deprecated** — intentionally retired or superseded.

The baseline requirements in this document are **Accepted**. Implementation status should be tracked separately so product intent is not confused with current code state.

### Requirement classes

| Prefix  | Meaning                                            |
| ------- | -------------------------------------------------- |
| `PRD`   | Product direction and product constraints          |
| `FR`    | Functional requirement                             |
| `NFR`   | Non-functional requirement                         |
| `SEC`   | Security and privacy requirement                   |
| `DATA`  | Evidence, provenance, and data-quality requirement |
| `SCORE` | Stack health scoring requirement                   |
| `GOV`   | Requirements governance and traceability           |

## 2. Product vision

StackLens helps developers understand the health of a software stack and decide what deserves attention.

The initial product focuses on JavaScript and TypeScript projects. A developer can provide a `package.json` or a public GitHub repository and receive an accurate, useful, evidence-backed report describing:

- what the stack contains;
- what is outdated, deprecated, risky, overlapping, unnecessary, or otherwise worth attention;
- what frameworks, tools, and project configuration are present;
- what migrations or improvements are relevant;
- why each finding exists;
- how findings are prioritized; and
- how the overall stack health score is calculated.

The long-term product expands from dependency analysis into whole-repository intelligence covering source code, architecture, tests, CI/CD, security, performance, and technical debt.

## 3. Product principles

### PRD-001 — Evidence before advice

**Phase:** Core  
**Status:** Accepted

StackLens must not present an actionable recommendation without explaining why the recommendation exists and what evidence supports it.

### PRD-002 — Deterministic analysis first

**Phase:** Core  
**Status:** Accepted

StackLens's core analysis must be based on deterministic/static analysis and verifiable external metadata. AI or LLM inference must not be required to produce the MVP analysis.

### PRD-003 — Facts and heuristics are distinct

**Phase:** Core  
**Status:** Accepted

StackLens must visibly distinguish directly observed facts from heuristic findings and recommendations.

### PRD-004 — Honest uncertainty

**Phase:** Core  
**Status:** Accepted

When StackLens lacks enough information to make a reliable determination, it must say so rather than treating missing evidence as a negative finding.

### PRD-005 — Individual-first, team-capable

**Phase:** Core  
**Status:** Accepted

StackLens should optimize its initial experience for individual developers while keeping the product model suitable for senior developers, tech leads, and engineering teams.

### PRD-006 — Open-source core and hosted product

**Phase:** Product direction  
**Status:** Accepted

StackLens is intended to have an open-source core with a hosted SaaS experience. MVP scope must not be distorted by premature monetization requirements.

### PRD-007 — Web first

**Phase:** Core  
**Status:** Accepted

The web application is the first product surface. CLI, GitHub automation, and IDE integrations follow after the web experience is established.

## 4. Target users

### Primary personas

1. **Individual developer** — wants a fast health check and clear next actions for a project.
2. **Senior developer / tech lead** — wants evidence and prioritization for technical-debt decisions.
3. **Engineering team** — wants repeatable analysis, monitoring, and eventually automated repository workflows.

The MVP UX is optimized for the first persona without creating data models or analysis concepts that prevent the other personas from being supported later.

## 5. Scope

### 5.1 MVP scope

The MVP supports JavaScript and TypeScript projects and provides two analysis modes:

#### Quick analysis

Input:

- pasted `package.json`; or
- uploaded `package.json`.

Quick analysis can only make findings supported by package metadata and available external data. Findings that require repository source/configuration must be marked unavailable or omitted rather than guessed.

#### Repository analysis

Input:

- public GitHub repository URL.

Repository analysis may inspect relevant repository files without executing repository code.

### 5.2 Post-MVP / future scope

The product vision includes:

- authenticated GitHub connections and private repositories;
- saved repositories and historical health trends;
- continuous monitoring and meaningful-change notifications;
- source-code analysis;
- architecture analysis and visualization;
- deeper test analysis;
- CI/CD analysis;
- security analysis beyond package vulnerability lookup;
- performance analysis;
- technical-debt tracking;
- migration instructions;
- generated code/config changes;
- branch creation and automatic pull requests with explicit user approval;
- CLI;
- GitHub Action/App;
- IDE integration;
- additional ecosystems beyond JavaScript/TypeScript.

### 5.3 Explicit MVP non-goals

The MVP does **not** require:

- AI/LLM-generated analysis;
- support for Python or other non-JS/TS ecosystems;
- private repository access;
- GitLab/Bitbucket integrations;
- automatic code changes;
- automatic pull requests;
- continuous monitoring;
- notifications;
- full cross-workspace monorepo intelligence;
- executing package scripts, builds, tests, or arbitrary repository code.

Workspace/monorepo configuration may be detected in MVP, but complete multi-package analysis is a later capability.

## 6. MVP functional requirements

### FR-001 — Paste package manifest

**Phase:** MVP  
**Status:** Accepted

A user must be able to paste valid `package.json` content and request a quick analysis.

**Acceptance criteria**

- Valid JSON with a supported package manifest is accepted.
- Invalid JSON returns a clear validation error.
- Analysis can be performed without creating an account.

### FR-002 — Upload package manifest

**Phase:** MVP  
**Status:** Accepted

A user must be able to upload a `package.json` file for quick analysis.

**Acceptance criteria**

- A supported manifest can be selected and analyzed.
- Invalid or unsupported files fail safely with an actionable message.
- The uploaded manifest is subject to the data-retention requirements in this document.

### FR-003 — Analyze public GitHub repository

**Phase:** MVP  
**Status:** Accepted

A user must be able to submit a public GitHub repository URL for repository analysis.

**Acceptance criteria**

- Valid public GitHub repository URLs can be resolved.
- Invalid, inaccessible, or unsupported URLs produce a clear error.
- StackLens identifies the analyzed repository and revision/reference where available.

### FR-004 — Validate analysis inputs

**Phase:** MVP  
**Status:** Accepted

StackLens must validate analysis inputs before analysis and must not silently reinterpret invalid input.

### FR-005 — Dependency inventory

**Phase:** MVP  
**Status:** Accepted

StackLens must identify declared runtime and development dependencies and relevant dependency groups from the analyzed project.

**Acceptance criteria**

- The report identifies dependency name, declared version/range, and dependency group.
- The report does not silently merge dependency groups when that would change meaning.

### FR-006 — Outdated dependency detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify dependencies for which a newer relevant release exists.

**Acceptance criteria**

- The report distinguishes the project's declared version/range from the comparison version.
- Version comparisons include evidence/provenance.
- Major-version differences are distinguishable from minor/patch differences.

### FR-007 — Deprecated or unmaintained dependency detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify packages that are explicitly deprecated and may identify packages showing evidence of being unmaintained.

**Acceptance criteria**

- Explicit deprecation is presented as a fact with its source.
- "Unmaintained" is presented as a heuristic unless supported by an authoritative declaration.
- Heuristic maintenance findings expose their basis and confidence.

### FR-008 — Overlapping or redundant dependency detection

**Phase:** MVP  
**Status:** Accepted

StackLens must detect known cases where multiple dependencies provide materially overlapping responsibilities.

**Acceptance criteria**

- A finding names the overlapping packages/capabilities.
- The finding explains why the overlap matters.
- StackLens must not claim that a dependency is redundant solely because another library exists in the same broad category.

### FR-009 — Potentially unnecessary dependency detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify potentially unnecessary dependencies when sufficient deterministic evidence exists.

**Acceptance criteria**

- Findings are labeled as potential/heuristic unless necessity can be established directly.
- Repository analysis may use imports, configuration, scripts, and other static evidence.
- Quick analysis must not claim source-level non-use when source code was not provided.
- The report states when the available input is insufficient for this analysis.

### FR-010 — Dependency health signals

**Phase:** MVP  
**Status:** Accepted

StackLens must provide relevant dependency-health signals derived from verifiable metadata.

Possible signals include release recency, deprecation state, repository/archive state, maintenance activity, and other supported signals.

**Acceptance criteria**

- Every signal identifies its data source.
- A combined interpretation must disclose the rule used to derive it.

### FR-011 — Known vulnerability detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify known vulnerabilities affecting dependencies when supported by available version information and vulnerability data.

**Acceptance criteria**

- Findings identify the affected package and advisory/vulnerability reference.
- Severity is attributed to the underlying source when provided.
- Lack of vulnerability data must not be described as proof that a package is secure.

### FR-012 — Framework and tool detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify supported frameworks and development tools that can be established from the available project evidence.

Examples include frameworks, build tools, test frameworks, linters/formatters, package managers, state-management libraries, observability tools, and related development tooling.

### FR-013 — Project configuration detection

**Phase:** MVP  
**Status:** Accepted

For repository analysis, StackLens must identify supported project configuration files and relevant high-level configuration characteristics through static inspection.

**Acceptance criteria**

- Detection does not execute configuration code.
- Unsupported or dynamic configuration is reported as unsupported/partially inspected rather than guessed.
- Supported literal JavaScript/TypeScript exports, immutable local constants, and explicitly
  recognized configuration wrappers may be inspected through the static parser. Imported presets
  and runtime-dependent values remain unresolved; no configuration code is executed.

### FR-014 — Migration opportunity detection

**Phase:** MVP  
**Status:** Accepted

StackLens must identify relevant migration opportunities when a deterministic rule and sufficient evidence indicate that a project may benefit from a known migration path.

**Acceptance criteria**

- The current state and target state are identified.
- The reason for suggesting the migration is shown.
- The evidence and rule that triggered the suggestion are shown.
- A migration is not presented as mandatory unless the underlying evidence establishes that it is required.

### FR-015 — Evidence-backed recommendations

**Phase:** MVP  
**Status:** Accepted

StackLens must convert supported findings into actionable recommendations where appropriate.

Each recommendation must include:

- what StackLens suggests considering;
- why;
- supporting evidence;
- impact/rationale;
- confidence when heuristic;
- relevant source references; and
- the analysis rule identifier.

### FR-016 — Prioritized technical-debt actions

**Phase:** MVP  
**Status:** Accepted

StackLens must present findings in a prioritized action view so users can understand what deserves attention first.

**Acceptance criteria**

- Priority is produced by an explicit deterministic rule.
- Priority considers supported factors such as security impact, breakage/deprecation risk, evidence strength, and likely maintenance impact.
- Priority is explainable; it must not be an opaque AI judgment.

### FR-017 — Finding evidence

**Phase:** MVP  
**Status:** Accepted

Every factual finding and every actionable recommendation must expose the evidence that caused the finding.

See `DATA-001` through `DATA-006`.

### FR-018 — Stack health score

**Phase:** MVP  
**Status:** Accepted

StackLens must provide an overall stack health score on a 0–100 scale when sufficient evidence exists.

### FR-019 — Category health scores

**Phase:** MVP  
**Status:** Accepted

StackLens must support category-level scores for:

- Dependencies
- Security
- Maintainability
- Testing
- Tooling

A category with insufficient evidence must be shown as **N/A / insufficient evidence** rather than automatically receiving a low score.

The initial complete five-category policy uses explicit scopes: dependency version health, known
dependency advisories, major-version migration readiness, static test setup, and tooling
reproducibility. Testing checks supported declared test commands and conventional test-file
presence. Tooling checks an exact supported package-manager pin and matching root lockfile evidence.
Absence-based setup findings require complete relevant acquisition, remain heuristic, and do not
claim that tests/tools were executed. Unsupported custom commands or lockfile formats remain N/A.
Precise gates, deductions, and overall aggregation are versioned in ADR-0012 and the scoring policy.

### FR-020 — Explain scoring

**Phase:** MVP  
**Status:** Accepted

Users must be able to understand why a health score has its value.

**Acceptance criteria**

- Score-impacting findings are visible.
- Weighting/rules are documented.
- Missing evidence is not silently converted into a penalty.
- The same evidence and scoring-rule version produce the same score.
- Each category states the supported scope and exposes the reasons it cannot be scored.
- Score eligibility and the number of available category scores must not be labeled as the
  percentage of source files, packages, or repository evidence inspected.
- Stored reports retain their original scoring version and values; unimplemented policies in
  historical reports are distinguished from incomplete evidence in supported policies.

### FR-021 — Analysis limitations

**Phase:** MVP  
**Status:** Accepted

Every analysis must communicate material limitations caused by input mode, unsupported configuration, unavailable external data, or insufficient evidence.

Equivalent repeated limitation messages should be grouped for presentation while retaining all
affected categories, rules, and score links. Repository acquisition must support ordinary
multi-hundred-file projects within coordinated finite request, file, and byte budgets, and report
truncation honestly. A limitation outside a score's documented scope must not invalidate complete
evidence for that scope; failures capable of suppressing a scored finding must still block it.

### FR-022 — Anonymous quick use

**Phase:** MVP  
**Status:** Accepted

Users must be able to perform simple StackLens analysis without creating an account.

### FR-023 — Resolved dependency evidence

**Phase:** MVP  
**Status:** Accepted

For repository analysis, StackLens must use supported committed root lockfiles as project evidence for
the exact resolved version of a declared dependency when that resolution can be matched
deterministically to the corresponding package.json declaration.

Initial supported lockfiles are:

- `package-lock.json`;
- `pnpm-lock.yaml`; and
- `yarn.lock`.

**Acceptance criteria**

- package.json remains the authoritative source of dependency declaration intent and dependency group.
- A lockfile-resolved version is accepted only when StackLens can match the dependency name and
  declared specifier without guessing.
- Supported exact package.json declarations remain valid current-version evidence without requiring a
  lockfile.
- A matching supported lockfile may satisfy exact-current-version requirements for ranged package.json
  declarations used by version, deprecation, migration, vulnerability, and scoring rules.
- Multiple ambiguous lockfiles, package-manager mismatches, stale specifiers, malformed lockfiles,
  missing direct resolutions, workspace/link targets, and unsupported non-semver resolutions produce
  limitations rather than inferred versions.
- Lockfile source text remains transient analysis input; reports expose only bounded normalized
  resolution facts/evidence and must not copy full lockfile contents.
- Lockfile evidence does not prove that dependencies were installed or executed in the analyzed
  runtime environment.

## 7. Post-MVP functional requirements

### FR-100 — GitHub authentication and private repositories

**Phase:** Next  
**Status:** Accepted

Users must be able to connect GitHub and explicitly grant access to supported private repositories.

Access must comply with `SEC-004`, `SEC-005`, and `SEC-006`.

### FR-101 — Saved repositories

**Phase:** Next  
**Status:** Accepted

Authenticated users must be able to save repositories for later analysis and monitoring without requiring permanent storage of repository source code.

### FR-102 — Historical analysis

**Phase:** Next  
**Status:** Accepted

StackLens must be able to show how supported findings and scores change between analysis snapshots.

### FR-103 — Change monitoring and notifications

**Phase:** Future  
**Status:** Accepted

StackLens should detect meaningful changes such as new vulnerabilities, package deprecations, significant dependency updates, and newly applicable migration rules and notify opted-in users.

### FR-104 — Migration instructions

**Phase:** Future  
**Status:** Accepted

StackLens should be able to provide step-by-step migration guidance tied to an evidence-backed migration finding.

### FR-105 — Generated changes

**Phase:** Future  
**Status:** Accepted

StackLens may generate proposed source/configuration changes for an accepted recommendation.

Generated changes must be reviewable before application.

### FR-106 — Branch creation

**Phase:** Future  
**Status:** Accepted

With explicit authorization, StackLens may create a repository branch containing user-approved proposed changes.

### FR-107 — Pull request creation

**Phase:** Future  
**Status:** Accepted

With explicit authorization, StackLens may open a pull request containing user-approved proposed changes and must reference the findings/rules that motivated the change.

### FR-108 — CLI

**Phase:** Future  
**Status:** Accepted

StackLens should provide a CLI capable of running supported analysis in developer and CI workflows.

### FR-109 — GitHub automation

**Phase:** Future  
**Status:** Accepted

StackLens should support GitHub-native automation, such as a GitHub Action or GitHub App, after the web analysis model is stable.

### FR-110 — IDE integration

**Phase:** Future  
**Status:** Accepted

StackLens should support an IDE integration after the web and automation analysis contracts are stable.

### FR-111 — Whole-repository source analysis

**Phase:** Future  
**Status:** Accepted

StackLens should extend deterministic analysis to source-code structure and supported static code patterns.

### FR-112 — Architecture analysis

**Phase:** Future  
**Status:** Accepted

StackLens should derive and visualize supported architectural relationships from repository evidence.

### FR-113 — Test analysis

**Phase:** Future  
**Status:** Accepted

StackLens should analyze supported test configuration, structure, and available test-quality signals without treating unobserved runtime behavior as fact.

### FR-114 — CI/CD analysis

**Phase:** Future  
**Status:** Accepted

StackLens should analyze supported CI/CD configuration for project-health and maintainability findings.

### FR-115 — Expanded security analysis

**Phase:** Future  
**Status:** Accepted

StackLens should expand security analysis beyond dependency advisories using deterministic/static techniques.

### FR-116 — Performance analysis

**Phase:** Future  
**Status:** Accepted

StackLens should support evidence-backed performance findings when they can be established reliably.

### FR-117 — Technical-debt tracking

**Phase:** Future  
**Status:** Accepted

StackLens should track accepted technical-debt findings over time, including resolution and recurrence.

### FR-118 — Additional ecosystems

**Phase:** Future  
**Status:** Accepted

The analyzer architecture must permit support for additional ecosystems without rewriting the product's core finding/evidence/scoring model.

## 8. Evidence and data requirements

### DATA-001 — Provenance

**Phase:** MVP  
**Status:** Accepted

Every external-data-backed finding must identify the source from which the evidence was obtained.

### DATA-002 — Evidence timestamp

**Phase:** MVP  
**Status:** Accepted

Time-sensitive external evidence must include or be associated with the time it was retrieved/evaluated.

### DATA-003 — Rule identity

**Phase:** MVP  
**Status:** Accepted

Every generated finding must identify the analyzer rule that produced it using a stable rule identifier.

### DATA-004 — Confidence for heuristics

**Phase:** MVP  
**Status:** Accepted

Heuristic findings must expose a confidence level or equivalent confidence explanation and the facts used to derive it.

### DATA-005 — Fact/recommendation separation

**Phase:** MVP  
**Status:** Accepted

The analysis model must represent observed facts separately from recommendations so the UI cannot accidentally present advice as raw fact.

### DATA-006 — Reproducibility metadata

**Phase:** MVP  
**Status:** Accepted

An analysis result must record enough metadata to explain its basis, including the StackLens analyzer/rule version and the analyzed project reference or input fingerprint where appropriate.

## 9. Scoring requirements

### SCORE-001 — Deterministic scoring

**Phase:** MVP  
**Status:** Accepted

Health scores must be calculated by versioned deterministic rules. An LLM must not determine or modify the score.

### SCORE-002 — Explainable contribution

**Phase:** MVP  
**Status:** Accepted

Every score deduction or positive contribution must be attributable to documented evidence and a scoring rule.

### SCORE-003 — No penalty for missing evidence

**Phase:** MVP  
**Status:** Accepted

Unavailable or unsupported evidence must not automatically reduce a project's score. Affected categories must be marked N/A or calculated only from supported evidence, with the limitation disclosed.

### SCORE-004 — Comparable only under compatible rules

**Phase:** MVP  
**Status:** Accepted

Historical or side-by-side score comparisons must identify scoring-rule version changes that could materially affect comparability.

## 10. Security and privacy requirements

### SEC-001 — Never execute analyzed repository code

**Phase:** MVP  
**Status:** Accepted

StackLens must not execute arbitrary code, package scripts, builds, tests, hooks, or dependency installation as part of MVP analysis.

Static parsing and metadata inspection are allowed.

### SEC-002 — Treat analyzed content as untrusted

**Phase:** MVP  
**Status:** Accepted

Repository contents, manifests, configuration, metadata, URLs, and third-party package information must be treated as untrusted input.

### SEC-003 — Minimize retention

**Phase:** MVP  
**Status:** Accepted

StackLens must retain only the minimum analysis input/data necessary to provide the requested feature.

### SEC-004 — Private source code is not permanently stored by default

**Phase:** Next  
**Status:** Accepted

When private repository support is introduced, private repository source code must not be permanently stored unless the user explicitly opts into a feature that requires storage and is informed of that requirement.

### SEC-005 — Least-privilege GitHub access

**Phase:** Next  
**Status:** Accepted

GitHub authentication/integration must request the minimum permissions necessary for the enabled StackLens features.

### SEC-006 — Explicit approval for repository writes

**Phase:** Future  
**Status:** Accepted

StackLens must never create branches, commits, or pull requests without explicit user authorization for repository write access and explicit user action/approval for the operation.

### SEC-007 — Secret exposure prevention

**Phase:** MVP  
**Status:** Accepted

StackLens must not intentionally collect or display repository secrets. Analysis and logging must be designed to avoid persisting sensitive values discovered in inspected files.

### SEC-008 — Safe external references

**Phase:** MVP  
**Status:** Accepted

External advisory/package/repository links shown as evidence must originate from known data sources or be safely validated before presentation.

## 11. Non-functional requirements

### NFR-001 — Deterministic core

**Phase:** MVP  
**Status:** Accepted

Given the same normalized project input, external-data snapshot, analyzer version, and rule set, StackLens must produce equivalent findings and scores.

### NFR-002 — Rule-level testability

**Phase:** MVP  
**Status:** Accepted

Each analysis rule must be independently testable using fixtures and expected findings.

### NFR-003 — Graceful partial failure

**Phase:** MVP  
**Status:** Accepted

Failure of one external data source or one unsupported analysis rule must not corrupt unrelated findings. The report must disclose material partial failures.

### NFR-004 — Extensible analyzer architecture

**Phase:** MVP  
**Status:** Accepted

The analysis model must separate ecosystem-specific detectors from generic finding, evidence, prioritization, and scoring concepts sufficiently to permit future ecosystems.

### NFR-005 — Stable finding contracts

**Phase:** MVP  
**Status:** Accepted

Findings must use stable identifiers and structured data contracts so the web app, future CLI, GitHub integrations, and IDE integrations can consume the same analysis model.

### NFR-006 — Accessible web experience

**Phase:** MVP  
**Status:** Accepted

The StackLens web experience should meet WCAG 2.2 AA for user-facing MVP flows.

### NFR-007 — Responsive web experience

**Phase:** MVP  
**Status:** Accepted

Core analysis submission and report flows must remain usable on common desktop, tablet, and mobile viewport sizes.

### NFR-008 — Analysis performance visibility

**Phase:** MVP  
**Status:** Accepted

Long-running repository analysis must provide visible progress/state rather than appearing frozen. External-service latency must be distinguishable from application failure where practical.

### NFR-009 — Observability without source leakage

**Phase:** MVP  
**Status:** Accepted

Operational logging/telemetry must support diagnosing failures without logging full repository contents, manifests, secrets, or sensitive source by default.

## 12. Requirements governance

### GOV-001 — Requirements are the source of truth

**Phase:** Core  
**Status:** Accepted

`docs/requirements.md` is the canonical source of product/system requirements.

### GOV-002 — Trace every product change

**Phase:** Core  
**Status:** Accepted

Every product issue, implementation task, pull request, and acceptance test must reference at least one applicable requirement ID.

Bug fixes must reference the requirement whose expected behavior is being restored.

### GOV-003 — Requirement before behavior

**Phase:** Core  
**Status:** Accepted

If proposed behavior is not covered by an accepted requirement, the requirement must be added or amended before, or in the same pull request as, the implementation.

### GOV-004 — Acceptance criteria traceability

**Phase:** Core  
**Status:** Accepted

Automated or manual acceptance tests should identify the requirement IDs they verify.

### GOV-005 — Requirement changes are explicit

**Phase:** Core  
**Status:** Accepted

Changes to accepted requirements must be explicit in a pull request and must describe the product impact. Requirements must not be silently reinterpreted through implementation.

### GOV-006 — Architecture serves requirements

**Phase:** Core  
**Status:** Accepted

Technology and architecture choices must cite the requirements they are intended to satisfy. A technology choice is not itself a product requirement.

### GOV-007 — Documentation and journey continuity

**Phase:** Core  
**Status:** Accepted

Every pull request must keep StackLens's durable documentation synchronized with the change and append a chronological entry to `docs/design/journey.md`.

**Acceptance criteria**

- The pull request identifies the requirement IDs it serves.
- The journey entry records what changed and why, including material decisions or corrections.
- Product behavior changes update `docs/requirements.md` when applicable.
- Architecture or technology changes update `docs/architecture.md` and/or the relevant ADR when applicable.
- Design-system, UI-pattern, or token changes update the relevant design documentation when applicable.
- Tooling, workflow, package, CI, editor, or agent-instruction changes update the relevant implementation/contributor documentation when applicable.
- Milestone/status changes update `README.md` when its current-status statement would otherwise become stale.
- A change is not considered complete while documentation that describes the changed area is knowingly stale.

## 13. MVP success definition

The MVP is successful when a developer can provide StackLens with a supported JavaScript/TypeScript project through an MVP input mode and receive an accurate, useful, evidence-backed report that tells them:

1. what their stack contains;
2. what deserves attention;
3. why each material finding exists;
4. what they should consider doing next;
5. how findings were prioritized;
6. how available health scores were calculated; and
7. what StackLens could not reliably determine from the available evidence.

The report must satisfy the deterministic, evidence, scoring, security, and traceability requirements defined above.

## 14. Initial requirement-to-capability map

| Capability                       | Requirements                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| Paste/upload analysis            | FR-001, FR-002, FR-004, FR-022                                     |
| Public GitHub analysis           | FR-003, FR-004, SEC-001, SEC-002                                   |
| Dependency inventory             | FR-005                                                             |
| Resolved dependency versions      | FR-023, FR-017, SCORE-003                                          |
| Outdated packages                | FR-006, DATA-001, DATA-002                                         |
| Deprecated/unmaintained packages | FR-007, DATA-004                                                   |
| Overlap/redundancy               | FR-008, PRD-003                                                    |
| Potentially unnecessary packages | FR-009, PRD-004, DATA-004                                          |
| Dependency health                | FR-010                                                             |
| Vulnerabilities                  | FR-011, DATA-001                                                   |
| Framework/tool detection         | FR-012                                                             |
| Configuration detection          | FR-013, SEC-001                                                    |
| Migration opportunities          | FR-014                                                             |
| Recommendations                  | FR-015, PRD-001                                                    |
| Prioritization                   | FR-016                                                             |
| Evidence model                   | FR-017, DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, DATA-006 |
| Health scoring                   | FR-018, FR-019, FR-020, SCORE-001, SCORE-002, SCORE-003            |
| Limitations                      | FR-021, PRD-004                                                    |
| Documentation continuity         | GOV-007                                                            |
| Analyzer design                  | NFR-001, NFR-002, NFR-004, NFR-005                                 |
| Privacy/security                 | SEC-001, SEC-002, SEC-003, SEC-007, NFR-009                        |
| Future GitHub private access     | FR-100, SEC-004, SEC-005                                           |
| Future automated changes         | FR-105, FR-106, FR-107, SEC-006                                    |
| Future integrations              | FR-108, FR-109, FR-110, NFR-005                                    |

## 15. Implementation decisions outside the requirements

Technology and architecture decisions are intentionally kept outside the product requirements so that implementation choices do not redefine product behavior (**GOV-006**).

The accepted architecture and current technology selections are documented in [architecture.md](architecture.md) and the architecture decision records under [adr/](adr/).

Some lower-level choices remain intentionally deferred, including exact scoring weights, exact priority coefficients, hosted cloud provider, authentication provider details, cache infrastructure, and future monorepo-expansion behavior. These may be selected only insofar as they satisfy the accepted requirements.
